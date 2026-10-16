<?php

namespace App\Sms;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class LogSmsSender implements SmsSender
{
    public function send(string $to, string $body): string
    {
        $id = 'log-'.Str::uuid();
        Log::info('SMS (log driver, not sent)', ['id' => $id, 'to' => $to, 'body' => $body]);

        return $id;
    }
}
