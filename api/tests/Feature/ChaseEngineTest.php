<?php

namespace Tests\Feature;

use App\Enums\ChaseLogStatus;
use App\Enums\InvoiceStatus;
use App\Jobs\SendChaseReminder;
use App\Mail\ChaseReminderMail;
use App\Models\ChaseLog;
use App\Models\ChaseSequence;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Notifications\ReminderFailed;
use App\Sms\SmsException;
use App\Sms\SmsSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ChaseEngineTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Client $client;

    private ChaseSequence $sequence;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now('UTC')->setTime(12, 0));
        $this->user = User::factory()->create(['timezone' => 'UTC', 'payment_url' => 'https://pay.example.com/default']);
        $this->client = Client::factory()->for($this->user)->create(['email' => 'ap@client.test', 'phone' => '+15550001111']);
        $this->sequence = $this->user->chaseSequences()->create(['name' => 'Test', 'is_default' => true]);
        $this->sequence->steps()->createMany([
            ['trigger_type' => 'before_due', 'days_offset' => 3, 'channel' => 'email', 'subject' => 'Due soon {invoice_number}', 'template_body' => 'Hi {client_name}, {amount_due} due {due_date}. {payment_link}'],
            ['trigger_type' => 'after_due', 'days_offset' => 0, 'channel' => 'email', 'subject' => 'Due today', 'template_body' => 'Due today'],
            ['trigger_type' => 'after_due', 'days_offset' => 7, 'channel' => 'email', 'subject' => '{days_overdue} days overdue', 'template_body' => 'Overdue by {days_overdue}'],
            ['trigger_type' => 'after_due', 'days_offset' => 14, 'channel' => 'sms', 'subject' => null, 'template_body' => '{company_name}: {invoice_number} overdue'],
        ]);
    }

    private function invoiceDueIn(int $days, array $attrs = []): Invoice
    {
        return Invoice::factory()->for($this->client)->dueInDays($days)->create(['user_id' => $this->user->id] + $attrs);
    }

    public function test_queues_exact_day_before_due_step(): void
    {
        Queue::fake();
        $invoice = $this->invoiceDueIn(3);

        $this->artisan('chase:run', ['--now' => true])->assertSuccessful();

        $log = ChaseLog::sole();
        $this->assertSame($invoice->id, $log->invoice_id);
        $this->assertSame(ChaseLogStatus::Queued, $log->status);
        $this->assertSame('ap@client.test', $log->recipient);
        Queue::assertPushed(SendChaseReminder::class, fn ($job) => $job->chaseLogId === $log->id);
    }

    public function test_running_twice_never_double_sends(): void
    {
        Queue::fake();
        $this->invoiceDueIn(3);

        $this->artisan('chase:run', ['--now' => true]);
        $this->artisan('chase:run', ['--now' => true]);

        $this->assertSame(1, ChaseLog::count());
        Queue::assertPushed(SendChaseReminder::class, 1);
    }

    public function test_missed_before_due_step_is_skipped_not_sent_late(): void
    {
        Queue::fake();
        $this->invoiceDueIn(1);

        $this->artisan('chase:run', ['--now' => true]);

        $log = ChaseLog::sole();
        $this->assertSame(ChaseLogStatus::Skipped, $log->status);
        Queue::assertNothingPushed();
    }

    public function test_overdue_catch_up_sends_only_latest_step(): void
    {
        Queue::fake();
        $invoice = $this->invoiceDueIn(-10);

        $this->artisan('chase:run', ['--now' => true]);

        $this->assertSame(InvoiceStatus::Overdue, $invoice->fresh()->status);
        $byOffset = ChaseLog::with('step')->get()->mapWithKeys(fn ($l) => [$l->step->signedOffset() => $l->status]);
        $this->assertSame(ChaseLogStatus::Queued, $byOffset[7]);
        $this->assertSame(ChaseLogStatus::Skipped, $byOffset[0]);
        $this->assertSame(ChaseLogStatus::Skipped, $byOffset[-3]);
        $this->assertFalse($byOffset->has(14));
        Queue::assertPushed(SendChaseReminder::class, 1);
    }

    public function test_undeliverable_latest_channel_falls_back_to_latest_usable_step(): void
    {
        Queue::fake();
        $this->client->update(['phone' => null]);
        $this->invoiceDueIn(-20);

        $this->artisan('chase:run', ['--now' => true]);

        $byOffset = ChaseLog::with('step')->get()->mapWithKeys(fn ($l) => [$l->step->signedOffset() => $l]);
        $this->assertSame(ChaseLogStatus::Queued, $byOffset[7]->status);
        $this->assertSame(ChaseLogStatus::Skipped, $byOffset[14]->status);
        $this->assertSame('The client has no mobile number.', $byOffset[14]->error_message);
        Queue::assertPushed(SendChaseReminder::class, 1);
    }

    public function test_paid_draft_and_cancelled_invoices_are_never_chased(): void
    {
        Queue::fake();
        $this->invoiceDueIn(-7, ['status' => 'paid']);
        $this->invoiceDueIn(-7, ['status' => 'draft']);
        $this->invoiceDueIn(-7, ['status' => 'cancelled']);

        $this->artisan('chase:run', ['--now' => true]);

        $this->assertSame(0, ChaseLog::count());
    }

    public function test_respects_local_send_hour(): void
    {
        Queue::fake();
        $this->travelTo(now('UTC')->setTime(2, 0));
        $this->invoiceDueIn(3);

        $this->artisan('chase:run');
        $this->assertSame(0, ChaseLog::count());

        $this->user->update(['timezone' => 'Asia/Karachi']);
        $this->artisan('chase:run');
        $this->assertSame(0, ChaseLog::count(), 'Karachi is 07:00 — still before 09:00');

        $this->user->update(['timezone' => 'Pacific/Auckland']);
        $this->artisan('chase:run');
        $this->assertGreaterThan(0, ChaseLog::count());
    }

    public function test_sms_step_skipped_for_opted_out_client(): void
    {
        Queue::fake();
        $this->client->update(['sms_opt_out' => true]);
        $this->invoiceDueIn(-14);

        $this->artisan('chase:run', ['--now' => true]);

        $sms = ChaseLog::where('channel', 'sms')->sole();
        $this->assertSame(ChaseLogStatus::Skipped, $sms->status);
        $this->assertStringContainsString('opted out', $sms->error_message);
    }

    public function test_job_sends_rendered_email_and_records_message_id(): void
    {
        Mail::fake();
        $invoice = $this->invoiceDueIn(3, ['invoice_number' => 'INV-77', 'amount' => '1500.00']);

        $this->artisan('chase:run', ['--now' => true]);

        Mail::assertSent(ChaseReminderMail::class, function (ChaseReminderMail $mail) {
            return $mail->hasTo('ap@client.test')
                && $mail->renderedSubject === 'Due soon INV-77'
                && str_contains($mail->renderedBody, '$1,500.00')
                && str_contains($mail->renderedBody, $this->client->name)
                && $mail->paymentLink === 'https://pay.example.com/default';
        });
        $log = ChaseLog::sole();
        $this->assertSame(ChaseLogStatus::Sent, $log->status);
        $this->assertSame(1, $log->attempts);
        $this->assertNotNull($log->sent_at);
    }

    public function test_job_stops_if_invoice_paid_after_queueing(): void
    {
        Mail::fake();
        $invoice = $this->invoiceDueIn(3);
        $log = ChaseLog::create([
            'invoice_id' => $invoice->id, 'chase_step_id' => $this->sequence->steps()->first()->id,
            'channel' => 'email', 'recipient' => 'ap@client.test', 'status' => ChaseLogStatus::Queued,
            'scheduled_for' => now()->toDateString(),
        ]);
        $invoice->update(['status' => InvoiceStatus::Paid]);

        (new SendChaseReminder($log->id))->handle(app(SmsSender::class));

        Mail::assertNothingSent();
        $this->assertSame(ChaseLogStatus::Cancelled, $log->fresh()->status);
    }

    public function test_rendered_email_escapes_client_supplied_text(): void
    {
        $this->client->update(['name' => '<script>alert(1)</script>']);
        $invoice = $this->invoiceDueIn(3)->load('user', 'client');
        $mail = new ChaseReminderMail($invoice, 'Subject', 'Hi <script>alert(1)</script>', 'https://pay.example.com/x');

        $html = $mail->render();

        $this->assertStringNotContainsString('<script>alert(1)</script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }

    public function test_sms_permanent_failure_marks_failed_opts_out_and_notifies(): void
    {
        Notification::fake();
        $this->app->bind(SmsSender::class, fn () => new class implements SmsSender
        {
            public function send(string $to, string $body): string
            {
                throw new SmsException('Opted out', 21610, true);
            }
        });
        $invoice = $this->invoiceDueIn(-14);
        $smsStep = $this->sequence->steps()->where('channel', 'sms')->first();
        $log = ChaseLog::create([
            'invoice_id' => $invoice->id, 'chase_step_id' => $smsStep->id, 'channel' => 'sms',
            'recipient' => '+15550001111', 'status' => ChaseLogStatus::Queued, 'scheduled_for' => now()->toDateString(),
        ]);

        try {
            SendChaseReminder::dispatchSync($log->id);
        } catch (\Throwable) {
        }

        $this->assertSame(ChaseLogStatus::Failed, $log->fresh()->status);
        $this->assertTrue($this->client->fresh()->sms_opt_out);
        Notification::assertSentTo($this->user, ReminderFailed::class);
    }

    public function test_job_retry_configuration_matches_requirement(): void
    {
        $job = new SendChaseReminder(1);
        $this->assertSame(4, $job->tries, 'one attempt + 3 retries');
        $this->assertCount(3, $job->backoff());
    }

    public function test_invoice_detail_lists_upcoming_reminders(): void
    {
        $invoice = $this->invoiceDueIn(10);

        $res = $this->asUser($this->user)->getJson("/api/invoices/{$invoice->id}")->assertOk();
        $this->assertSame(['scheduled', 'scheduled', 'scheduled', 'scheduled'], array_column($res->json('upcoming'), 'state'));
        $this->assertSame(now()->addDays(7)->toDateString(), $res->json('upcoming.0.date'));
    }
}
