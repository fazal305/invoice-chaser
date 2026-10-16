<?php

namespace App\Http\Controllers\Api;

use App\Enums\ChaseLogStatus;
use App\Http\Controllers\Controller;
use App\Models\ChaseLog;
use App\Services\InvoiceStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private const DELIVERED = ['sent', 'delivered', 'opened'];

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        InvoiceStatusService::sweepOverdue($user);
        $today = $user->localToday()->toDateString();
        $currency = $user->currency;

        $outstanding = DB::table('invoices')
            ->where('user_id', $user->id)->whereIn('status', ['sent', 'overdue'])
            ->groupBy('currency')
            ->selectRaw('currency, SUM(amount) as total, COUNT(*) as count, SUM(status = ?) as overdue_count, SUM(CASE WHEN status = ? THEN amount ELSE 0 END) as overdue_total', ['overdue', 'overdue'])
            ->orderByRaw('currency = ? DESC', [$currency])->orderByDesc('total')
            ->get()
            ->map(fn ($r) => [
                'currency' => $r->currency,
                'total' => number_format((float) $r->total, 2, '.', ''),
                'count' => (int) $r->count,
                'overdue_count' => (int) $r->overdue_count,
                'overdue_total' => number_format((float) $r->overdue_total, 2, '.', ''),
            ]);

        $avgDaysOverdue = DB::table('invoices')
            ->where('user_id', $user->id)->where('status', 'overdue')
            ->selectRaw('AVG(DATEDIFF(?, due_date)) as avg_days', [$today])
            ->value('avg_days');

        $aging = DB::table('invoices')
            ->where('user_id', $user->id)->whereIn('status', ['sent', 'overdue'])->where('currency', $currency)
            ->selectRaw("
                SUM(CASE WHEN due_date >= ? THEN amount ELSE 0 END) as current_amt,
                SUM(CASE WHEN DATEDIFF(?, due_date) BETWEEN 1 AND 30 THEN amount ELSE 0 END) as d30,
                SUM(CASE WHEN DATEDIFF(?, due_date) BETWEEN 31 AND 60 THEN amount ELSE 0 END) as d60,
                SUM(CASE WHEN DATEDIFF(?, due_date) BETWEEN 61 AND 90 THEN amount ELSE 0 END) as d90,
                SUM(CASE WHEN DATEDIFF(?, due_date) > 90 THEN amount ELSE 0 END) as d90plus
            ", [$today, $today, $today, $today, $today])
            ->first();

        $chased = DB::table('invoices')
            ->where('invoices.user_id', $user->id)
            ->whereExists(fn ($q) => $q->from('chase_logs')->whereColumn('chase_logs.invoice_id', 'invoices.id')->whereIn('chase_logs.status', self::DELIVERED))
            ->selectRaw('COUNT(*) as chased, SUM(status = ?) as paid, SUM(status IN (?, ?)) as open_count', ['paid', 'sent', 'overdue'])
            ->first();

        $reminders = DB::table('chase_logs')
            ->join('invoices', 'invoices.id', '=', 'chase_logs.invoice_id')
            ->where('invoices.user_id', $user->id)
            ->where('chase_logs.updated_at', '>=', now()->subDays(30))
            ->groupBy('chase_logs.status')
            ->selectRaw('chase_logs.status, COUNT(*) as n')
            ->pluck('n', 'status');

        $attention = $user->invoices()->with('client:id,name')
            ->where('status', 'overdue')->orderBy('due_date')->limit(5)
            ->get(['id', 'client_id', 'invoice_number', 'amount', 'currency', 'due_date']);

        $recent = ChaseLog::query()
            ->join('invoices', 'invoices.id', '=', 'chase_logs.invoice_id')
            ->where('invoices.user_id', $user->id)
            ->whereIn('chase_logs.status', [...self::DELIVERED, 'failed', 'bounced'])
            ->orderByDesc('chase_logs.updated_at')->limit(6)
            ->get(['chase_logs.id', 'chase_logs.invoice_id', 'chase_logs.channel', 'chase_logs.status', 'chase_logs.recipient', 'chase_logs.sent_at', 'chase_logs.updated_at', 'invoices.invoice_number']);

        $chasedCount = (int) ($chased->chased ?? 0);

        return response()->json([
            'currency' => $currency,
            'outstanding' => $outstanding,
            'avg_days_overdue' => $avgDaysOverdue !== null ? round((float) $avgDaysOverdue, 1) : null,
            'aging' => [
                ['key' => 'current', 'label' => 'Not yet due', 'amount' => (float) ($aging->current_amt ?? 0)],
                ['key' => '1_30', 'label' => '1–30 days', 'amount' => (float) ($aging->d30 ?? 0)],
                ['key' => '31_60', 'label' => '31–60 days', 'amount' => (float) ($aging->d60 ?? 0)],
                ['key' => '61_90', 'label' => '61–90 days', 'amount' => (float) ($aging->d90 ?? 0)],
                ['key' => '90_plus', 'label' => 'Over 90 days', 'amount' => (float) ($aging->d90plus ?? 0)],
            ],
            'chase' => [
                'chased' => $chasedCount,
                'paid' => (int) ($chased->paid ?? 0),
                'open' => (int) ($chased->open_count ?? 0),
                'success_rate' => $chasedCount > 0 ? round(100 * (int) $chased->paid / $chasedCount, 1) : null,
            ],
            'reminders_30d' => [
                'sent' => (int) (($reminders[ChaseLogStatus::Sent->value] ?? 0) + ($reminders['delivered'] ?? 0) + ($reminders['opened'] ?? 0)),
                'delivered' => (int) (($reminders['delivered'] ?? 0) + ($reminders['opened'] ?? 0)),
                'opened' => (int) ($reminders['opened'] ?? 0),
                'failed' => (int) (($reminders['failed'] ?? 0) + ($reminders['bounced'] ?? 0)),
            ],
            'needs_attention' => $attention->map(fn ($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'client_name' => $i->client?->name,
                'amount' => $i->amount,
                'currency' => $i->currency,
                'due_date' => $i->due_date->toDateString(),
            ]),
            'recent' => $recent->map(fn ($l) => [
                'id' => $l->id,
                'invoice_id' => $l->invoice_id,
                'invoice_number' => $l->invoice_number,
                'channel' => $l->channel,
                'status' => $l->status->value,
                'recipient' => $l->recipient,
                'at' => ($l->sent_at ?? $l->updated_at)?->toIso8601String(),
            ]),
        ]);
    }
}
