{!! $body !!}
@if ($paymentLink)

Pay invoice: {!! $paymentLink !!}
@endif
@if ($paymentInstructions)

Payment details:
{!! $paymentInstructions !!}
@endif

--
You're receiving this because {!! $companyName !!} issued you an invoice. Reply to this email to reach them directly.
