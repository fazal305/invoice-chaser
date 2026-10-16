<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'client_id', 'chase_sequence_id', 'invoice_number', 'amount', 'currency',
    'status', 'issue_date', 'due_date', 'payment_url', 'notes', 'paid_at',
])]
class Invoice extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'status' => InvoiceStatus::class,
            'amount' => 'decimal:2',
            'issue_date' => 'immutable_date',
            'due_date' => 'immutable_date',
            'paid_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function chaseSequence(): BelongsTo
    {
        return $this->belongsTo(ChaseSequence::class);
    }

    public function chaseLogs(): HasMany
    {
        return $this->hasMany(ChaseLog::class);
    }
}
