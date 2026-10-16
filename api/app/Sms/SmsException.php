<?php

namespace App\Sms;

use RuntimeException;

class SmsException extends RuntimeException
{
    public function __construct(string $message, public readonly ?int $providerCode = null, public readonly bool $permanent = false)
    {
        parent::__construct($message);
    }
}
