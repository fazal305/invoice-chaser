<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Models\UserLogo;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ChaseReminderMail extends Mailable
{
    public function __construct(
        public Invoice $invoice,
        public string $renderedSubject,
        public string $renderedBody,
        public ?string $paymentLink,
    ) {}

    public function envelope(): Envelope
    {
        $user = $this->invoice->user;

        return new Envelope(
            from: new Address(config('mail.from.address'), $user->company_name),
            replyTo: [new Address($user->reply_to_email ?: $user->email, $user->company_name)],
            subject: $this->renderedSubject,
        );
    }

    public function content(): Content
    {
        $user = $this->invoice->user;
        $logo = UserLogo::find($user->id);

        return new Content(
            view: 'mail.chase-reminder',
            text: 'mail.chase-reminder-text',
            with: [
                'companyName' => $user->company_name,
                'body' => $this->renderedBody,
                'paymentLink' => $this->paymentLink,
                'paymentInstructions' => $user->payment_instructions,
                'logo' => $logo,
            ],
        );
    }
}
