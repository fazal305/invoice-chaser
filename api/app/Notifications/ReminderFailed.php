<?php

namespace App\Notifications;

use App\Models\ChaseLog;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ReminderFailed extends Notification
{
    public function __construct(public ChaseLog $log) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'reminder_failed',
            'invoice_id' => $this->log->invoice_id,
            'invoice_number' => $this->log->invoice->invoice_number,
            'channel' => $this->log->channel,
            'recipient' => $this->log->recipient,
            'reason' => $this->log->error_message,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $channel = $this->log->channel === 'sms' ? 'SMS' : 'email';
        $url = rtrim((string) config('app.frontend_url'), '/').'/app/invoices/'.$this->log->invoice_id;

        return (new MailMessage)
            ->subject("A reminder for invoice {$this->log->invoice->invoice_number} could not be sent")
            ->line("We tried to send an {$channel} reminder to {$this->log->recipient} four times without success.")
            ->line('Reason: '.$this->log->error_message)
            ->action('View invoice', $url)
            ->line('Check the client’s contact details, then the next scheduled reminder will go out as normal.');
    }
}
