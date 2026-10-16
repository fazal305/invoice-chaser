<?php

namespace Tests\Feature;

use App\Enums\ChaseLogStatus;
use App\Models\ChaseLog;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\DefaultSequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CronTest extends TestCase
{
    use RefreshDatabase;

    public function test_disabled_without_secret_and_rejects_wrong_token(): void
    {
        config(['services.cron.secret' => '']);
        $this->postJson('/api/cron/run', [], ['Authorization' => 'Bearer anything'])->assertUnauthorized();

        config(['services.cron.secret' => 'right-secret']);
        $this->postJson('/api/cron/run')->assertUnauthorized();
        $this->postJson('/api/cron/run', [], ['Authorization' => 'Bearer wrong'])->assertUnauthorized();
    }

    public function test_runs_chase_and_sends_reminders(): void
    {
        config(['services.cron.secret' => 'right-secret', 'services.chase.send_hour' => 0]);
        $user = User::factory()->create();
        DefaultSequence::createFor($user);
        Invoice::factory()->for(Client::factory()->for($user))->dueInDays(-8)->create(['user_id' => $user->id]);

        $this->postJson('/api/cron/run', [], ['Authorization' => 'Bearer right-secret'])
            ->assertOk()->assertJsonPath('message', 'OK');

        $this->assertSame(ChaseLogStatus::Sent, ChaseLog::where('status', 'sent')->sole()->status);
    }
}
