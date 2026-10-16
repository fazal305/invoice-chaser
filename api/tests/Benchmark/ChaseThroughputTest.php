<?php

namespace Tests\Benchmark;

use App\Models\ChaseLog;
use App\Models\User;
use App\Services\DefaultSequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * NFR 4.2: 1,000+ invoices processed within 5 minutes.
 * Run with: php artisan test --testsuite=Benchmark
 * Uses the database queue and the array mailer, so provider network latency is not included.
 */
class ChaseThroughputTest extends TestCase
{
    use RefreshDatabase;

    private const USERS = 25;

    private const INVOICES_PER_USER = 50;

    public function test_scan_and_send_1250_invoices_under_five_minutes(): void
    {
        config(['queue.default' => 'database']);
        $this->travelTo(now('UTC')->setTime(12, 0));
        $now = now();

        for ($u = 0; $u < self::USERS; $u++) {
            $user = User::factory()->create();
            DefaultSequence::createFor($user);
            $clientIds = [];
            for ($c = 0; $c < 10; $c++) {
                $clientIds[] = DB::table('clients')->insertGetId([
                    'user_id' => $user->id, 'name' => "Client $u-$c", 'email' => "c$u-$c@bench.test",
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
            $rows = [];
            for ($i = 0; $i < self::INVOICES_PER_USER; $i++) {
                $rows[] = [
                    'user_id' => $user->id, 'client_id' => $clientIds[$i % 10], 'invoice_number' => "B-$u-$i",
                    'amount' => 100 + $i, 'currency' => 'USD', 'status' => 'sent',
                    'issue_date' => $now->copy()->subDays(60)->toDateString(),
                    'due_date' => $now->copy()->subDays(7 + ($i % 20))->toDateString(),
                    'created_at' => $now, 'updated_at' => $now,
                ];
            }
            DB::table('invoices')->insert($rows);
        }
        $total = self::USERS * self::INVOICES_PER_USER;

        $t0 = microtime(true);
        Artisan::call('chase:run', ['--now' => true]);
        $scan = microtime(true) - $t0;

        $t1 = microtime(true);
        Artisan::call('queue:work', ['--stop-when-empty' => true, '--sleep' => 0]);
        $send = microtime(true) - $t1;

        $sent = ChaseLog::where('status', 'sent')->count();
        fwrite(STDERR, sprintf("\n[benchmark] %d invoices: scan+enqueue %.2fs, send %d reminders %.2fs, total %.2fs\n", $total, $scan, $sent, $send, $scan + $send));

        $this->assertSame($total, $sent, 'every invoice should receive exactly one reminder');
        $this->assertLessThan(300, $scan + $send);
    }
}
