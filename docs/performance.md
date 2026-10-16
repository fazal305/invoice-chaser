# Performance

## NFR 4.2 — 1,000+ invoices within 5 minutes

`api/tests/Benchmark/ChaseThroughputTest.php` seeds 25 accounts × 50 overdue invoices (1,250 total), runs `chase:run`, then drains the **database** queue with one `queue:work` process.

| Step | Time |
|---|---|
| Scan 1,250 invoices and queue reminders | 15.2 s |
| Send 1,250 reminders (1 worker) | 26.3 s |
| **Total** | **41.5 s** (target: under 300 s) |

Measured on 2026-10-16 on a Windows dev laptop (PHP 8.4, MySQL 8.4, no OPcache). The mailer was Laravel's in-memory `array` driver, so this measures the app, not provider latency. With a real SMTP/API provider at ~200–400 ms per message, one worker sends roughly 150–300 reminders a minute; run more `queue:work` processes to scale — jobs are independent and each reminder is claimed by a unique `(invoice, step)` row, so parallel workers can't double-send.

Run it yourself:

```bash
cd api && php artisan test --testsuite=Benchmark
```

## How the scan stays cheap

- Only users with open invoices are loaded; invoices are read in chunks of 500 with their clients eager-loaded.
- Existing reminder logs for a chunk are fetched in one query (no N+1).
- `invoices(status, due_date)` and `invoices(user_id, status, due_date)` indexes back the overdue sweep and the scan.
- `chase_logs(invoice_id, chase_step_id)` is unique, which is both the idempotency guard and the lookup index.

## Frontend

Routes are lazy-loaded; the initial JS bundle is ~74 KB gzipped. Fonts are self-hosted variable fonts (no third-party requests).
