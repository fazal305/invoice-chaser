<?php

namespace Tests\Feature;

use App\Enums\ChaseLogStatus;
use App\Models\ChaseLog;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->client = Client::factory()->for($this->user)->create();
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'client_id' => $this->client->id,
            'invoice_number' => 'INV-1001',
            'amount' => '1250.50',
            'currency' => 'USD',
            'status' => 'sent',
            'issue_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'payment_url' => 'https://pay.example.com/inv-1001',
        ], $overrides);
    }

    public function test_create_and_list_invoice(): void
    {
        $this->asUser($this->user)->postJson('/api/invoices', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.amount', '1250.50')
            ->assertJsonPath('data.client.id', $this->client->id);

        $this->asUser($this->user)->getJson('/api/invoices?status=sent')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);
    }

    public function test_sent_invoice_with_past_due_date_is_stored_overdue(): void
    {
        $this->asUser($this->user)->postJson('/api/invoices', $this->payload([
            'issue_date' => now()->subDays(40)->toDateString(),
            'due_date' => now()->subDays(10)->toDateString(),
        ]))->assertCreated()->assertJsonPath('data.status', 'overdue');
    }

    public function test_listing_sweeps_sent_invoices_to_overdue(): void
    {
        $invoice = Invoice::factory()->for($this->client)->dueInDays(-2)->create(['user_id' => $this->user->id]);

        $this->asUser($this->user)->getJson('/api/invoices')->assertOk()->assertJsonPath('data.0.status', 'overdue');
        $this->assertSame('overdue', $invoice->fresh()->status->value);
    }

    public function test_validation_errors_are_field_level(): void
    {
        $other = Client::factory()->create();

        $this->asUser($this->user)->postJson('/api/invoices', $this->payload([
            'client_id' => $other->id,
            'amount' => '-5',
            'currency' => 'dollars',
            'due_date' => now()->subYear()->toDateString(),
            'payment_url' => 'http://insecure.example.com',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['client_id', 'amount', 'currency', 'due_date', 'payment_url']);
    }

    public function test_invoice_number_unique_per_user_only(): void
    {
        Invoice::factory()->for(Client::factory())->create(['invoice_number' => 'INV-1001']);

        $this->asUser($this->user)->postJson('/api/invoices', $this->payload())->assertCreated();
        $this->asUser($this->user)->postJson('/api/invoices', $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('invoice_number');
    }

    public function test_users_cannot_see_or_change_each_others_invoices(): void
    {
        $foreign = Invoice::factory()->create();

        $this->asUser($this->user)->getJson("/api/invoices/{$foreign->id}")->assertNotFound();
        $this->asUser($this->user)->putJson("/api/invoices/{$foreign->id}", $this->payload())->assertNotFound();
        $this->asUser($this->user)->postJson("/api/invoices/{$foreign->id}/status", ['status' => 'paid'])->assertNotFound();
        $this->asUser($this->user)->deleteJson("/api/invoices/{$foreign->id}")->assertNotFound();
        $this->asUser($this->user)->getJson('/api/invoices')->assertJsonCount(0, 'data');
        $this->asUser($this->user)->getJson("/api/clients/{$foreign->client_id}")->assertNotFound();
    }

    public function test_marking_paid_cancels_queued_reminders(): void
    {
        $invoice = Invoice::factory()->for($this->client)->create(['user_id' => $this->user->id]);
        $log = ChaseLog::create([
            'invoice_id' => $invoice->id, 'channel' => 'email', 'status' => ChaseLogStatus::Queued,
            'scheduled_for' => now()->toDateString(),
        ]);

        $this->asUser($this->user)->postJson("/api/invoices/{$invoice->id}/status", ['status' => 'paid'])
            ->assertOk()->assertJsonPath('data.status', 'paid');

        $this->assertNotNull($invoice->fresh()->paid_at);
        $this->assertSame(ChaseLogStatus::Cancelled, $log->fresh()->status);
    }

    public function test_illegal_transition_is_rejected(): void
    {
        $invoice = Invoice::factory()->for($this->client)->create(['user_id' => $this->user->id, 'status' => 'draft']);

        $this->asUser($this->user)->postJson("/api/invoices/{$invoice->id}/status", ['status' => 'paid'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->asUser($this->user)->postJson("/api/invoices/{$invoice->id}/status", ['status' => 'overdue'])
            ->assertUnprocessable();
    }

    public function test_reopening_paid_invoice_rederives_overdue(): void
    {
        $invoice = Invoice::factory()->for($this->client)->dueInDays(-5)->create([
            'user_id' => $this->user->id, 'status' => 'paid', 'paid_at' => now(),
        ]);

        $this->asUser($this->user)->postJson("/api/invoices/{$invoice->id}/status", ['status' => 'sent'])
            ->assertOk()->assertJsonPath('data.status', 'overdue')->assertJsonPath('data.paid_at', null);
    }

    public function test_paid_invoice_cannot_be_edited(): void
    {
        $invoice = Invoice::factory()->for($this->client)->create(['user_id' => $this->user->id, 'status' => 'paid']);

        $this->asUser($this->user)->putJson("/api/invoices/{$invoice->id}", $this->payload(['status' => null]))
            ->assertStatus(409);
    }

    public function test_client_with_invoices_cannot_be_deleted(): void
    {
        Invoice::factory()->for($this->client)->create(['user_id' => $this->user->id]);

        $this->asUser($this->user)->deleteJson("/api/clients/{$this->client->id}")->assertStatus(409);
    }

    public function test_client_requires_email_or_phone_and_valid_phone(): void
    {
        $this->asUser($this->user)->postJson('/api/clients', ['name' => 'No Contact'])
            ->assertUnprocessable()->assertJsonValidationErrors(['email', 'phone']);
        $this->asUser($this->user)->postJson('/api/clients', ['name' => 'Bad', 'phone' => '0300 1234567'])
            ->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->asUser($this->user)->postJson('/api/clients', ['name' => 'Good', 'phone' => '+923001234567'])
            ->assertCreated()->assertJsonPath('data.phone', '+923001234567');
    }

    public function test_search_treats_wildcards_literally(): void
    {
        Client::factory()->for($this->user)->create(['name' => 'Zed 100% Ltd']);

        $this->asUser($this->user)->getJson('/api/clients?q=%25')->assertOk()->assertJsonCount(1, 'data');
    }
}
