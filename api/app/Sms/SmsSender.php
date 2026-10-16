<?php

namespace App\Sms;

interface SmsSender
{
    /** Sends a message and returns the provider's message ID. */
    public function send(string $to, string $body): string;
}
