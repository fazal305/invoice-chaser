<?php

namespace App\Models;

use App\Enums\ChaseLogStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChaseLog extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'status' => ChaseLogStatus::class,
            'scheduled_for' => 'immutable_date',
            'sent_at' => 'immutable_datetime',
            'delivered_at' => 'immutable_datetime',
            'opened_at' => 'immutable_datetime',
            'attempts' => 'integer',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function step(): BelongsTo
    {
        return $this->belongsTo(ChaseStep::class, 'chase_step_id');
    }

    public function advanceTo(ChaseLogStatus $status, array $extra = []): bool
    {
        if ($status->rank() <= $this->status->rank()) {
            return false;
        }
        $this->fill(['status' => $status] + $extra)->save();

        return true;
    }
}
