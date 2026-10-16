<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'sms_opt_out' => $this->sms_opt_out,
            'invoices_count' => $this->whenCounted('invoices'),
            'open_invoices_count' => $this->when(isset($this->open_invoices_count), fn () => (int) $this->open_invoices_count),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
