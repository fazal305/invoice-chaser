<?php

namespace App\Enums;

enum ChaseLogStatus: string
{
    case Queued = 'queued';
    case Sent = 'sent';
    case Delivered = 'delivered';
    case Opened = 'opened';
    case Failed = 'failed';
    case Bounced = 'bounced';
    case Skipped = 'skipped';
    case Cancelled = 'cancelled';

    /** Higher rank wins, so a late "delivered" webhook never overwrites "opened". */
    public function rank(): int
    {
        return match ($this) {
            self::Queued => 0,
            self::Sent => 1,
            self::Delivered => 2,
            self::Opened => 3,
            self::Failed, self::Bounced, self::Skipped, self::Cancelled => 4,
        };
    }
}
