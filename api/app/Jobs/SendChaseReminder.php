<?php

namespace App\Jobs;

use App\Enums\ChaseLogStatus;
use App\Mail\ChaseReminderMail;
use App\Models\ChaseLog;
use App\Notifications\ReminderFailed;
use App\Services\TemplateRenderer;
use App\Sms\SmsException;
use App\Sms\SmsSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

class SendChaseReminder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    /** One attempt plus three retries. */
    public int $tries = 4;

    public int $timeout = 60;

    public function __construct(public int $chaseLogId) {}

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(SmsSender $sms): void
    {
        $log = ChaseLog::with(['invoice.user', 'invoice.client', 'step'])->find($this->chaseLogId);
        if (! $log || $log->status !== ChaseLogStatus::Queued) {
            return;
        }

        $invoice = $log->invoice;
        if (! $invoice->status->isChaseable()) {
            $log->update(['status' => ChaseLogStatus::Cancelled, 'error_message' => 'Stopped because the invoice is '.$invoice->status->value.'.']);

            return;
        }
        if (! $log->step) {
            $log->update(['status' => ChaseLogStatus::Cancelled, 'error_message' => 'The schedule step was removed before sending.']);

            return;
        }

        $log->increment('attempts');
        $values = TemplateRenderer::valuesFor($invoice);
        $body = TemplateRenderer::render($log->step->template_body, $values);

        try {
            if ($log->channel === 'sms') {
                if ($invoice->client->sms_opt_out) {
                    $log->update(['status' => ChaseLogStatus::Skipped, 'error_message' => 'The client has opted out of SMS.']);

                    return;
                }
                $messageId = $sms->send($log->recipient, $body."\nReply STOP to opt out.");
            } else {
                $subject = TemplateRenderer::render($log->step->subject ?? 'Invoice {invoice_number}', $values);
                $sent = Mail::to($log->recipient)->send(new ChaseReminderMail($invoice, $subject, $body, $values['payment_link'] === TemplateRenderer::NO_LINK ? null : $values['payment_link']));
                $messageId = $sent ? trim((string) $sent->getMessageId(), '<>') : null;
            }
        } catch (SmsException $e) {
            if ($e->providerCode === 21610) {
                $invoice->client->update(['sms_opt_out' => true]);
            }
            $log->update(['error_message' => $e->getMessage()]);
            if ($e->permanent) {
                $this->fail($e);

                return;
            }
            throw $e;
        } catch (TransportExceptionInterface $e) {
            Log::warning('Reminder email transport failure', ['chase_log_id' => $log->id, 'error' => $e->getMessage()]);
            $log->update(['error_message' => 'The email server did not accept the message.']);
            throw $e;
        }

        $log->update([
            'status' => ChaseLogStatus::Sent,
            'sent_at' => now(),
            'provider_message_id' => $messageId,
            'error_message' => null,
        ]);
    }

    public function failed(?Throwable $e): void
    {
        $log = ChaseLog::with('invoice.user')->find($this->chaseLogId);
        if (! $log || $log->status !== ChaseLogStatus::Queued) {
            return;
        }

        Log::error('Reminder failed after retries', ['chase_log_id' => $log->id, 'error' => $e?->getMessage()]);
        $log->update([
            'status' => ChaseLogStatus::Failed,
            'error_message' => $log->error_message ?: 'The reminder could not be sent.',
        ]);
        $log->invoice->user->notify(new ReminderFailed($log));
    }
}
