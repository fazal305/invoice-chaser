<?php

namespace App\Http\Controllers\Api;

use App\Enums\ChaseLogStatus;
use App\Http\Controllers\Controller;
use App\Models\ChaseLog;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    private const MAX_SKEW_SECONDS = 300;

    private const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT'];

    private const START_WORDS = ['START', 'UNSTOP', 'YES'];

    public function mailgun(Request $request): JsonResponse
    {
        $key = (string) config('services.mailgun.webhook_signing_key');
        $sig = $request->input('signature', []);
        $timestamp = (string) ($sig['timestamp'] ?? '');
        $token = (string) ($sig['token'] ?? '');
        $signature = (string) ($sig['signature'] ?? '');

        if ($key === '' || ! ctype_digit($timestamp) || $token === '' || $signature === '') {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }
        if (! hash_equals(hash_hmac('sha256', $timestamp.$token, $key), $signature)) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }
        if (abs(time() - (int) $timestamp) > self::MAX_SKEW_SECONDS) {
            return response()->json(['message' => 'Stale request.'], 401);
        }
        if (! Cache::add('webhook:mailgun:'.hash('sha256', $token), true, self::MAX_SKEW_SECONDS * 2)) {
            return response()->json(['message' => 'Duplicate ignored.']);
        }

        $event = $request->input('event-data', []);
        $messageId = trim((string) data_get($event, 'message.headers.message-id', ''), '<>');
        $log = $messageId !== '' ? ChaseLog::where('provider_message_id', $messageId)->where('channel', 'email')->first() : null;
        if (! $log) {
            return response()->json(['message' => 'No matching reminder.']);
        }

        $at = isset($event['timestamp']) ? now()->setTimestamp((int) $event['timestamp']) : now();
        match ($event['event'] ?? null) {
            'delivered' => $log->advanceTo(ChaseLogStatus::Delivered, ['delivered_at' => $at]),
            'opened' => $log->advanceTo(ChaseLogStatus::Opened, ['opened_at' => $at, 'delivered_at' => $log->delivered_at ?? $at]),
            'failed' => ($event['severity'] ?? '') === 'permanent'
                ? $log->advanceTo(ChaseLogStatus::Bounced, ['error_message' => 'The email bounced: '.mb_substr((string) data_get($event, 'delivery-status.description', data_get($event, 'reason', 'rejected by the recipient server')), 0, 200)])
                : null,
            default => null,
        };

        return response()->json(['message' => 'OK']);
    }

    public function twilioStatus(Request $request): JsonResponse
    {
        if (! $this->validTwilioSignature($request, (string) config('services.twilio.status_callback'))) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $log = ChaseLog::where('provider_message_id', (string) $request->input('MessageSid'))->where('channel', 'sms')->first();
        if (! $log) {
            return response()->json(['message' => 'No matching reminder.']);
        }

        match ($request->input('MessageStatus')) {
            'delivered' => $log->advanceTo(ChaseLogStatus::Delivered, ['delivered_at' => now()]),
            'undelivered', 'failed' => $log->advanceTo(ChaseLogStatus::Bounced, [
                'error_message' => 'The SMS could not be delivered (code '.((int) $request->input('ErrorCode')).').',
            ]),
            default => null,
        };

        return response()->json(['message' => 'OK']);
    }

    public function twilioInbound(Request $request): Response
    {
        $url = rtrim((string) config('app.url'), '/').'/api/webhooks/twilio/inbound';
        if (! $this->validTwilioSignature($request, $url)) {
            return response('Invalid signature.', 401);
        }

        $word = strtoupper(trim((string) $request->input('Body')));
        $from = (string) $request->input('From');
        if (preg_match('/^\+[1-9]\d{6,14}$/', $from)) {
            if (in_array($word, self::STOP_WORDS, true)) {
                Client::where('phone', $from)->update(['sms_opt_out' => true]);
                Log::info('SMS opt-out received', ['phone_suffix' => substr($from, -4)]);
            } elseif (in_array($word, self::START_WORDS, true)) {
                Client::where('phone', $from)->update(['sms_opt_out' => false]);
            }
        }

        return response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, ['Content-Type' => 'text/xml']);
    }

    /** https://www.twilio.com/docs/usage/security#validating-requests */
    private function validTwilioSignature(Request $request, string $url): bool
    {
        $token = (string) config('services.twilio.token');
        $given = (string) $request->header('X-Twilio-Signature');
        if ($token === '' || $url === '' || $given === '') {
            return false;
        }

        $params = $request->request->all();
        ksort($params);
        $data = $url;
        foreach ($params as $k => $v) {
            $data .= $k.(is_array($v) ? implode('', $v) : $v);
        }

        return hash_equals(base64_encode(hash_hmac('sha1', $data, $token, true)), $given);
    }
}
