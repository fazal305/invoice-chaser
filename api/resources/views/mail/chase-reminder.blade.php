<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $companyName }}</title>
</head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1b1f23;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2ded4;border-radius:12px;">
<tr><td style="padding:28px 28px 8px;">
@if ($logo)
<img src="{{ $message->embedData($logo->data, 'logo', $logo->mime) }}" alt="{{ $companyName }}" style="max-height:48px;max-width:200px;display:block;">
@else
<p style="margin:0;font-size:18px;font-weight:700;">{{ $companyName }}</p>
@endif
</td></tr>
<tr><td style="padding:16px 28px;font-size:15px;line-height:1.6;">
{!! nl2br(e($body)) !!}
</td></tr>
@if ($paymentLink)
<tr><td style="padding:4px 28px 20px;">
<a href="{{ $paymentLink }}" style="display:inline-block;background:#1f5f4a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Pay invoice</a>
</td></tr>
@endif
@if ($paymentInstructions)
<tr><td style="padding:0 28px 20px;font-size:13px;line-height:1.5;color:#555b62;">
<p style="margin:0 0 4px;font-weight:600;color:#1b1f23;">Payment details</p>
{!! nl2br(e($paymentInstructions)) !!}
</td></tr>
@endif
<tr><td style="padding:16px 28px 24px;border-top:1px solid #e2ded4;font-size:12px;color:#555b62;">
You're receiving this because {{ $companyName }} issued you an invoice. Reply to this email to reach them directly.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
