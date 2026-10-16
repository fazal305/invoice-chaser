<?php

namespace Tests\Feature;

use App\Enums\ChaseLogStatus;
use App\Models\ChaseLog;
use App\Models\Client;
use App\Models\Invoice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebhookTest extends TestCase
{
    use RefreshDatabase;

    private const MG_KEY = 'test-mailgun-signing-key';

    private const TW_TOKEN = 'test-twilio-auth-token';

    private ChaseLog $log;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.mailgun.webhook_signing_key' => self::MG_KEY,
            'services.twilio.token' => self::TW_TOKEN,
            'services.twilio.status_callback' => 'https://api.example.test/api/webhooks/twilio/status',
            'app.url' => 'https://api.example.test',
        ]);
        $invoice = Invoice::factory()->create();
        $this->log = ChaseLog::create([
            'invoice_id' => $invoice->id, 'channel' => 'email', 'recipient' => 'a@b.test',
            'status' => ChaseLogStatus::Sent, 'provider_message_id' => 'abc123@mail.test',
            'scheduled_for' => now()->toDateString(), 'sent_at' => now(),
        ]);
    }

    private function mailgun(string $event, array $extra = [], ?int $timestamp = null, ?string $token = null, ?string $key = null): array
    {
        $timestamp ??= time();
        $token ??= bin2hex(random_bytes(16));

        return [
            'signature' => [
                'timestamp' => (string) $timestamp,
                'token' => $token,
                'signature' => hash_hmac('sha256', $timestamp.$token, $key ?? self::MG_KEY),
            ],
            'event-data' => array_merge([
                'event' => $event,
                'timestamp' => $timestamp,
                'message' => ['headers' => ['message-id' => 'abc123@mail.test']],
            ], $extra),
        ];
    }

    public function test_mailgun_delivered_then_opened(): void
    {
        $this->postJson('/api/webhooks/mailgun', $this->mailgun('delivered'))->assertOk();
        $this->assertSame(ChaseLogStatus::Delivered, $this->log->fresh()->status);

        $this->postJson('/api/webhooks/mailgun', $this->mailgun('opened'))->assertOk();
        $this->assertSame(ChaseLogStatus::Opened, $this->log->fresh()->status);
        $this->assertNotNull($this->log->fresh()->opened_at);
    }

    public function test_late_delivered_event_does_not_downgrade_opened(): void
    {
        $this->postJson('/api/webhooks/mailgun', $this->mailgun('opened'))->assertOk();
        $this->postJson('/api/webhooks/mailgun', $this->mailgun('delivered'))->assertOk();

        $this->assertSame(ChaseLogStatus::Opened, $this->log->fresh()->status);
    }

    public function test_mailgun_rejects_bad_signature_and_stale_and_replayed(): void
    {
        $this->postJson('/api/webhooks/mailgun', $this->mailgun('opened', key: 'wrong-key'))->assertUnauthorized();
        $this->postJson('/api/webhooks/mailgun', $this->mailgun('opened', timestamp: time() - 3600))->assertUnauthorized();

        $payload = $this->mailgun('delivered', token: 'same-token');
        $this->postJson('/api/webhooks/mailgun', $payload)->assertOk()->assertJsonPath('message', 'OK');
        $this->postJson('/api/webhooks/mailgun', $payload)->assertOk()->assertJsonPath('message', 'Duplicate ignored.');

        $this->assertSame(ChaseLogStatus::Delivered, $this->log->fresh()->status);
    }

    public function test_mailgun_permanent_failure_marks_bounced(): void
    {
        $this->postJson('/api/webhooks/mailgun', $this->mailgun('failed', ['severity' => 'permanent', 'delivery-status' => ['description' => 'No such mailbox']]))->assertOk();

        $log = $this->log->fresh();
        $this->assertSame(ChaseLogStatus::Bounced, $log->status);
        $this->assertStringContainsString('No such mailbox', $log->error_message);
    }

    public function test_mailgun_disabled_without_signing_key(): void
    {
        config(['services.mailgun.webhook_signing_key' => '']);
        $this->postJson('/api/webhooks/mailgun', $this->mailgun('opened'))->assertUnauthorized();
    }

    private function twilioSign(string $url, array $params): string
    {
        ksort($params);
        $data = $url;
        foreach ($params as $k => $v) {
            $data .= $k.$v;
        }

        return base64_encode(hash_hmac('sha1', $data, self::TW_TOKEN, true));
    }

    public function test_twilio_status_callback_verified(): void
    {
        $this->log->update(['channel' => 'sms', 'provider_message_id' => 'SM123']);
        $params = ['MessageSid' => 'SM123', 'MessageStatus' => 'delivered'];
        $url = 'https://api.example.test/api/webhooks/twilio/status';

        $this->post('/api/webhooks/twilio/status', $params, ['X-Twilio-Signature' => 'bogus'])->assertUnauthorized();
        $this->assertSame(ChaseLogStatus::Sent, $this->log->fresh()->status);

        $this->post('/api/webhooks/twilio/status', $params, ['X-Twilio-Signature' => $this->twilioSign($url, $params)])->assertOk();
        $this->assertSame(ChaseLogStatus::Delivered, $this->log->fresh()->status);
    }

    public function test_twilio_inbound_stop_and_start(): void
    {
        $client = Client::factory()->create(['phone' => '+15559998888']);
        $url = 'https://api.example.test/api/webhooks/twilio/inbound';

        $stop = ['From' => '+15559998888', 'Body' => ' stop '];
        $this->post('/api/webhooks/twilio/inbound', $stop, ['X-Twilio-Signature' => $this->twilioSign($url, $stop)])->assertOk();
        $this->assertTrue($client->fresh()->sms_opt_out);

        $start = ['From' => '+15559998888', 'Body' => 'START'];
        $this->post('/api/webhooks/twilio/inbound', $start, ['X-Twilio-Signature' => $this->twilioSign($url, $start)])->assertOk();
        $this->assertFalse($client->fresh()->sms_opt_out);
    }
}
