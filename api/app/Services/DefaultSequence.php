<?php

namespace App\Services;

use App\Models\ChaseSequence;
use App\Models\User;

class DefaultSequence
{
    public static function createFor(User $user): ChaseSequence
    {
        $sequence = $user->chaseSequences()->create([
            'name' => 'Standard reminders',
            'is_default' => true,
        ]);

        $sequence->steps()->createMany([
            [
                'trigger_type' => 'before_due',
                'days_offset' => 3,
                'channel' => 'email',
                'subject' => 'Invoice {invoice_number} is due in 3 days',
                'template_body' => "Hi {client_name},\n\nA friendly reminder that invoice {invoice_number} for {amount_due} is due on {due_date}.\n\nYou can pay here: {payment_link}\n\nThank you,\n{company_name}",
            ],
            [
                'trigger_type' => 'after_due',
                'days_offset' => 0,
                'channel' => 'email',
                'subject' => 'Invoice {invoice_number} is due today',
                'template_body' => "Hi {client_name},\n\nInvoice {invoice_number} for {amount_due} is due today.\n\nPay online: {payment_link}\n\nIf you've already paid, please ignore this message.\n\n{company_name}",
            ],
            [
                'trigger_type' => 'after_due',
                'days_offset' => 7,
                'channel' => 'email',
                'subject' => 'Invoice {invoice_number} is now {days_overdue} days overdue',
                'template_body' => "Hi {client_name},\n\nOur records show invoice {invoice_number} for {amount_due} was due on {due_date} and is now {days_overdue} days overdue.\n\nPlease arrange payment here: {payment_link}\n\nIf there's a problem with the invoice, just reply and let us know.\n\n{company_name}",
            ],
        ]);

        return $sequence;
    }
}
