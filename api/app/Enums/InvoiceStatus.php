<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Overdue = 'overdue';
    case Paid = 'paid';
    case Cancelled = 'cancelled';

    public function isChaseable(): bool
    {
        return $this === self::Sent || $this === self::Overdue;
    }

    public function isOpen(): bool
    {
        return $this->isChaseable();
    }

    /** Statuses a user may move an invoice to from this one. Overdue is set by the system. */
    public function allowedTargets(): array
    {
        return match ($this) {
            self::Draft => [self::Sent, self::Cancelled],
            self::Sent, self::Overdue => [self::Paid, self::Cancelled],
            self::Paid => [self::Sent],
            self::Cancelled => [self::Draft],
        };
    }
}
