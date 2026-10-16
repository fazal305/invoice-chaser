<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['days_offset', 'trigger_type', 'channel', 'subject', 'template_body'])]
class ChaseStep extends Model
{
    use HasFactory;

    public const TRIGGERS = ['before_due', 'after_due'];

    public const CHANNELS = ['email', 'sms'];

    protected function casts(): array
    {
        return ['days_offset' => 'integer'];
    }

    public function sequence(): BelongsTo
    {
        return $this->belongsTo(ChaseSequence::class, 'chase_sequence_id');
    }

    /** Days relative to the due date: negative before, positive after. */
    public function signedOffset(): int
    {
        return $this->trigger_type === 'before_due' ? -$this->days_offset : $this->days_offset;
    }
}
