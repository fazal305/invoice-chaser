<?php

namespace App\Console\Commands;

use App\Enums\ChaseLogStatus;
use App\Enums\InvoiceStatus;
use App\Jobs\SendChaseReminder;
use App\Models\ChaseLog;
use App\Models\ChaseSequence;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\ChasePlanner;
use App\Services\InvoiceStatusService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class RunChases extends Command
{
    protected $signature = 'chase:run
        {--user= : Only process this user ID}
        {--now : Ignore the local send hour}';

    protected $description = 'Find invoices with reminders due today and queue them for sending';

    private int $queued = 0;

    private int $skipped = 0;

    public function handle(): int
    {
        $started = microtime(true);
        $sendHour = (int) config('services.chase.send_hour');
        $invoicesSeen = 0;

        User::query()
            ->when($this->option('user'), fn ($q, $id) => $q->whereKey($id))
            ->whereHas('invoices', fn ($q) => $q->whereIn('status', [InvoiceStatus::Sent, InvoiceStatus::Overdue]))
            ->chunkById(200, function (Collection $users) use ($sendHour, &$invoicesSeen) {
                foreach ($users as $user) {
                    if (! $this->option('now') && now($user->timezone)->hour < $sendHour) {
                        continue;
                    }
                    $invoicesSeen += $this->processUser($user);
                }
            });

        $this->info(sprintf(
            'Checked %d open invoices: %d reminders queued, %d skipped (%.2fs).',
            $invoicesSeen, $this->queued, $this->skipped, microtime(true) - $started,
        ));

        return self::SUCCESS;
    }

    private function processUser(User $user): int
    {
        InvoiceStatusService::sweepOverdue($user);
        $today = $user->localToday();

        $sequences = ChaseSequence::with('steps')->where('user_id', $user->id)->get()->keyBy('id');
        $default = $sequences->firstWhere('is_default', true);
        $count = 0;

        Invoice::with('client')
            ->where('user_id', $user->id)
            ->whereIn('status', [InvoiceStatus::Sent, InvoiceStatus::Overdue])
            ->chunkById(500, function (Collection $invoices) use ($sequences, $default, $today, $user, &$count) {
                $count += $invoices->count();
                $logged = ChaseLog::whereIn('invoice_id', $invoices->modelKeys())
                    ->whereNotNull('chase_step_id')
                    ->get(['invoice_id', 'chase_step_id'])
                    ->groupBy('invoice_id')
                    ->map(fn ($rows) => $rows->pluck('chase_step_id')->flip()->map(fn () => true)->all());

                foreach ($invoices as $invoice) {
                    $invoice->setRelation('user', $user);
                    $sequence = $sequences->get($invoice->chase_sequence_id) ?? $default;
                    if (! $sequence) {
                        continue;
                    }
                    $usable = ChasePlanner::channelUsableFor($invoice->client);
                    $plan = ChasePlanner::plan($invoice, $sequence->steps, $logged->get($invoice->id, []), $today, $usable);

                    foreach ($plan['skip'] as [$step, $date]) {
                        $this->record($invoice, $step, $date, ChaseLogStatus::Skipped, $usable($step->channel)
                            ? 'A later reminder was due, so this one was skipped.'
                            : $this->unusableReason($invoice->client, $step->channel));
                    }
                    foreach ($plan['send'] as [$step, $date]) {
                        $this->queue($invoice, $step, $date);
                    }
                }
            });

        return $count;
    }

    private function unusableReason(Client $client, string $channel): string
    {
        if ($channel === 'email') {
            return 'The client has no email address.';
        }

        return $client->phone ? 'The client has opted out of SMS.' : 'The client has no mobile number.';
    }

    private function queue(Invoice $invoice, $step, CarbonImmutable $date): void
    {
        $recipient = $step->channel === 'sms' ? $invoice->client->phone : $invoice->client->email;

        $log = $this->record($invoice, $step, $date, ChaseLogStatus::Queued, null, $recipient);
        if ($log) {
            SendChaseReminder::dispatch($log->id);
            $this->queued++;
        }
    }

    private function record(Invoice $invoice, $step, CarbonImmutable $date, ChaseLogStatus $status, ?string $reason, ?string $recipient = null): ?ChaseLog
    {
        $log = ChaseLog::createOrFirst(
            ['invoice_id' => $invoice->id, 'chase_step_id' => $step->id],
            [
                'channel' => $step->channel,
                'recipient' => $recipient,
                'status' => $status,
                'scheduled_for' => $date->toDateString(),
                'error_message' => $reason,
            ],
        );

        if (! $log->wasRecentlyCreated) {
            return null;
        }
        if ($status === ChaseLogStatus::Skipped) {
            $this->skipped++;
        }

        return $log;
    }
}
