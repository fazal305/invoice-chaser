<?php

namespace Database\Factories;

use App\Enums\InvoiceStatus;
use App\Models\Client;
use App\Models\Invoice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    public function definition(): array
    {
        $issued = now()->subDays(10)->startOfDay();

        return [
            'client_id' => Client::factory(),
            'user_id' => fn (array $attrs) => Client::find($attrs['client_id'])->user_id,
            'invoice_number' => 'INV-'.fake()->unique()->numerify('#####'),
            'amount' => fake()->randomFloat(2, 50, 5000),
            'currency' => 'USD',
            'status' => InvoiceStatus::Sent,
            'issue_date' => $issued->toDateString(),
            'due_date' => $issued->copy()->addDays(30)->toDateString(),
        ];
    }

    public function dueInDays(int $days): static
    {
        return $this->state(fn () => ['due_date' => now()->startOfDay()->addDays($days)->toDateString()]);
    }
}
