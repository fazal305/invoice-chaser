<?php

namespace App\Sms;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class TwilioSmsSender implements SmsSender
{
    // Twilio error codes that will never succeed on retry.
    private const PERMANENT = [21211, 21408, 21610, 21612, 21614];

    public function __construct(private string $sid, private string $token, private string $from, private ?string $statusCallback = null) {}

    public function send(string $to, string $body): string
    {
        try {
            $response = Http::asForm()
                ->withBasicAuth($this->sid, $this->token)
                ->timeout(15)
                ->post("https://api.twilio.com/2010-04-01/Accounts/{$this->sid}/Messages.json", array_filter([
                    'To' => $to,
                    'From' => $this->from,
                    'Body' => $body,
                    'StatusCallback' => $this->statusCallback,
                ]));
        } catch (ConnectionException) {
            throw new SmsException('Could not reach the SMS provider.');
        }

        if ($response->successful()) {
            return (string) $response->json('sid');
        }

        $code = (int) $response->json('code');
        $message = match ($code) {
            21610 => 'The recipient has replied STOP and opted out of SMS.',
            21211, 21614 => 'The phone number is not a valid mobile number.',
            21408 => 'SMS to this country is not enabled for the sending account.',
            default => 'The SMS provider rejected the message (code '.($code ?: $response->status()).').',
        };

        throw new SmsException($message, $code ?: null, in_array($code, self::PERMANENT, true));
    }
}
