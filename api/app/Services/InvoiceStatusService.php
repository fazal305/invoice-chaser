<?php

namespace App\Services;

use App\Enums\ChaseLogStatus;
use App\Enums\InvoiceStatus;
use App\Models\ChaseLog;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceStatusService
{
    /** Sent invoices past their due date (in the owner's timezone) become overdue. */
    public static function sweepOverdue(User $user): int
    {
        return Invoice::where('user_id', $user->id)
            ->where('status', InvoiceStatus::Sent)
            ->where('due_date', '<', $user->localToday()->toDateString())
            ->update(['status' => InvoiceStatus::Overdue, 'updated_at' => now()]);
    }

    public static function derive(InvoiceStatus $requested, string $dueDate, User $user): InvoiceStatus
    {
        if ($requested === InvoiceStatus::Sent && $dueDate < $user->localToday()->toDateString()) {
            return InvoiceStatus::Overdue;
        }

        return $requested;
    }

    public static function transition(Invoice $invoice, InvoiceStatus $target): Invoice
    {
        $current = $invoice->status;
        if ($current === $target) {
            return $invoice;
        }
        if (! in_array($target, $current->allowedTargets(), true)) {
            throw ValidationException::withMessages([
                'status' => "An invoice that is {$current->value} can't be marked {$target->value}.",
            ]);
        }

        return DB::transaction(function () use ($invoice, $target) {
            $resolved = self::derive($target, $invoice->due_date->toDateString(), $invoice->user);
            $invoice->status = $resolved;
            $invoice->paid_at = $resolved === InvoiceStatus::Paid ? now() : null;
            $invoice->save();

            if (! $resolved->isChaseable()) {
                self::cancelPendingReminders($invoice);
            }

            return $invoice;
        });
    }

    public static function cancelPendingReminders(Invoice $invoice): int
    {
        return ChaseLog::where('invoice_id', $invoice->id)
            ->where('status', ChaseLogStatus::Queued)
            ->update([
                'status' => ChaseLogStatus::Cancelled,
                'error_message' => 'Stopped because the invoice is '.$invoice->status->value.'.',
                'updated_at' => now(),
            ]);
    }
}
