<?php

namespace App\Services;

use App\Models\Invoice;
use Carbon\CarbonImmutable;

class TemplateRenderer
{
    public const PLACEHOLDERS = [
        'client_name', 'invoice_number', 'amount_due', 'due_date',
        'days_overdue', 'payment_link', 'company_name', 'issue_date',
    ];

    public const NO_LINK = '(reply to this message for payment details)';

    /** Returns placeholders in the text that we don't know how to fill. */
    public static function unknownPlaceholders(string $text): array
    {
        preg_match_all('/\{([a-z_]+)\}/i', $text, $m);

        return array_values(array_unique(array_diff($m[1], self::PLACEHOLDERS)));
    }

    public static function valuesFor(Invoice $invoice, ?CarbonImmutable $today = null): array
    {
        $user = $invoice->user;
        $today ??= $user->localToday();
        $overdue = max(0, (int) $invoice->due_date->diffInDays($today, false));

        return [
            'client_name' => $invoice->client->name,
            'invoice_number' => $invoice->invoice_number,
            'amount_due' => self::money((string) $invoice->amount, $invoice->currency),
            'due_date' => $invoice->due_date->format('j M Y'),
            'issue_date' => $invoice->issue_date->format('j M Y'),
            'days_overdue' => (string) $overdue,
            'payment_link' => $invoice->payment_url ?: ($user->payment_url ?: self::NO_LINK),
            'company_name' => $user->company_name,
        ];
    }

    /** Plain-text substitution; callers escape for their output format. */
    public static function render(string $template, array $values): string
    {
        $out = preg_replace_callback('/\{([a-z_]+)\}/i', function ($m) use ($values) {
            $key = strtolower($m[1]);

            return array_key_exists($key, $values) ? $values[$key] : $m[0];
        }, $template);

        return trim(preg_replace("/\n{3,}/", "\n\n", $out));
    }

    public static function money(string $amount, string $currency): string
    {
        $symbols = ['USD' => '$', 'EUR' => '€', 'GBP' => '£', 'INR' => '₹', 'PKR' => 'Rs ', 'AED' => 'AED ', 'CAD' => 'CA$', 'AUD' => 'A$'];
        $formatted = number_format((float) $amount, 2);

        return isset($symbols[$currency]) ? $symbols[$currency].$formatted : $formatted.' '.$currency;
    }
}
