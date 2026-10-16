# Security Policy

## Reporting a vulnerability

Please report security issues privately by email to **fazalabbas2002@gmail.com** rather than opening a public issue. Include steps to reproduce and the affected version or commit.

You can expect an acknowledgement within 5 days. Once a fix is ready, it will be released and the report credited if you'd like.

## Scope

In scope: the Laravel API (`api/`), the React app (`web/`), and the webhook endpoints. Please only test against your own local copy — do not scan or load-test any hosted instance.

## What's already in place

- Bearer tokens (Laravel Sanctum) that expire after 7 days; bcrypt password hashing
- Every query scoped to the signed-in user; other users' records return 404
- Rate limits on sign-in/registration (per IP and per email), uploads, the API, and webhooks
- Server-side validation on every write; Eloquent/query builder only, no string-built SQL
- Uploads: extension allowlist, server-side MIME sniffing, random filenames, stored outside the web root
- Webhooks: HMAC signature check with `hash_equals`, timestamp window and replay protection (Mailgun), Twilio request signing
- Security headers on API responses; no cookies set by the API
