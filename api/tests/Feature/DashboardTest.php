<?php

namespace Tests\Feature;

use App\Enums\ChaseLogStatus;
use App\Models\ChaseLog;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_metrics_are_scoped_and_correct(): void
    {
        $this->travelTo(now('UTC')->setTime(12, 0));
        $user = User::factory()->create(['currency' => 'USD']);
        $client = Client::factory()->for($user)->create();
        $make = fn (int $due, array $a = []) => Invoice::factory()->for($client)->dueInDays($due)->create(['user_id' => $user->id] + $a);

        $current = $make(10, ['amount' => '100.00']);
        $late20 = $make(-20, ['amount' => '200.00']);
        $late40 = $make(-40, ['amount' => '300.00']);
        $paid = $make(-5, ['amount' => '999.00', 'status' => 'paid']);
        $make(-5, ['amount' => '50.00', 'currency' => 'EUR']);
        Invoice::factory()->dueInDays(-100)->create(['amount' => '5000.00']);

        foreach ([$late20, $paid] as $inv) {
            ChaseLog::create(['invoice_id' => $inv->id, 'channel' => 'email', 'status' => ChaseLogStatus::Sent, 'scheduled_for' => now()->toDateString(), 'sent_at' => now()]);
        }

        $res = $this->asUser($user)->getJson('/api/dashboard')->assertOk();

        $this->assertSame('USD', $res->json('outstanding.0.currency'));
        $this->assertSame('600.00', $res->json('outstanding.0.total'));
        $this->assertSame(2, $res->json('outstanding.0.overdue_count'));
        $this->assertSame('EUR', $res->json('outstanding.1.currency'));
        $this->assertEquals(21.7, $res->json('avg_days_overdue'));
        $this->assertEquals([100, 200, 300, 0, 0], array_column($res->json('aging'), 'amount'));
        $this->assertSame(['chased' => 2, 'paid' => 1, 'open' => 1, 'success_rate' => 50], $res->json('chase'));
        $this->assertSame(2, $res->json('reminders_30d.sent'));
        $this->assertSame($late40->id, $res->json('needs_attention.0.id'));
    }

    public function test_empty_account_returns_zeroes(): void
    {
        $user = User::factory()->create();

        $this->asUser($user)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('outstanding', [])
            ->assertJsonPath('avg_days_overdue', null)
            ->assertJsonPath('chase.success_rate', null);
    }
}
