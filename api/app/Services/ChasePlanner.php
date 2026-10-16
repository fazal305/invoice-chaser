<?php

namespace App\Services;

use App\Models\ChaseStep;
use App\Models\Client;
use App\Models\Invoice;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Decides which steps of a chase schedule are due for an invoice on a given day.
 *
 * Steps on or before the due date only fire on their exact day, so a late run never sends
 * a stale "due in 3 days" message. Overdue steps catch up: if several were missed, only the
 * latest is sent and the earlier ones are recorded as skipped.
 */
class ChasePlanner
{
    public static function channelUsableFor(Client $client): \Closure
    {
        return fn (string $channel) => $channel === 'sms'
            ? $client->phone !== null && ! $client->sms_opt_out
            : $client->email !== null;
    }

    /**
     * @param  Collection<int, ChaseStep>  $steps
     * @param  array<int, true>  $loggedStepIds  step IDs that already have a log for this invoice
     * @return array{send: list<array{0: ChaseStep, 1: CarbonImmutable}>, skip: list<array{0: ChaseStep, 1: CarbonImmutable}>, upcoming: list<array{0: ChaseStep, 1: CarbonImmutable}>}
     */
    public static function plan(Invoice $invoice, Collection $steps, array $loggedStepIds, CarbonImmutable $today, ?callable $channelUsable = null): array
    {
        $channelUsable ??= fn (string $channel) => true;
        $due = $invoice->due_date->toImmutable()->startOfDay();
        $ready = [];
        $upcoming = [];

        foreach ($steps as $step) {
            if (isset($loggedStepIds[$step->id])) {
                continue;
            }
            $date = $due->addDays($step->signedOffset());
            if ($date->lte($today)) {
                $ready[] = [$step, $date];
            } else {
                $upcoming[] = [$step, $date];
            }
        }

        // Steps on a channel the client can't receive must not suppress an earlier step they can.
        $eligible = array_filter($ready, fn ($r) => ($r[0]->signedOffset() > 0 || $r[1]->equalTo($today)) && $channelUsable($r[0]->channel));
        $latest = $eligible ? max(array_map(fn ($r) => $r[1]->toDateString(), $eligible)) : null;

        $send = [];
        $skip = [];
        foreach ($ready as $r) {
            if ($latest !== null && $r[1]->toDateString() === $latest && in_array($r, $eligible, true)) {
                $send[] = $r;
            } else {
                $skip[] = $r;
            }
        }

        usort($upcoming, fn ($a, $b) => $a[1] <=> $b[1]);

        return ['send' => $send, 'skip' => $skip, 'upcoming' => $upcoming];
    }
}
