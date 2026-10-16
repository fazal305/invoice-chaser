<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'status' => $this->status->value,
            'allowed_statuses' => array_map(fn ($s) => $s->value, $this->status->allowedTargets()),
            'issue_date' => $this->issue_date->toDateString(),
            'due_date' => $this->due_date->toDateString(),
            'payment_url' => $this->payment_url,
            'notes' => $this->notes,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'chase_sequence_id' => $this->chase_sequence_id,
            'client' => new ClientResource($this->whenLoaded('client')),
            'chase_sequence' => $this->whenLoaded('chaseSequence', fn () => $this->chaseSequence ? [
                'id' => $this->chaseSequence->id,
                'name' => $this->chaseSequence->name,
            ] : null),
            'reminders_sent' => $this->when(isset($this->reminders_sent), fn () => (int) $this->reminders_sent),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
