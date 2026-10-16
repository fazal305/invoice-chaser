<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ImportTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['currency' => 'GBP']);
    }

    private function csv(string $content, string $name = 'data.csv'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $content);
    }

    private function upload(string $type, UploadedFile $file, array $extra = [])
    {
        return $this->asUser($this->user)->post("/api/import/$type", ['file' => $file] + $extra, ['Accept' => 'application/json']);
    }

    public function test_clients_dry_run_then_commit(): void
    {
        Client::factory()->for($this->user)->create(['email' => 'dupe@x.test']);
        $file = "\xEF\xBB\xBFName,Email,Phone\nAcme,ap@acme.test,+15550001234\nBad phone,b@x.test,0300 12\nDuplicate,dupe@x.test,\nNo contact,,\n";

        $this->upload('clients', $this->csv($file))->assertOk()
            ->assertJsonPath('total_rows', 4)
            ->assertJsonPath('valid_count', 1)
            ->assertJsonPath('error_count', 3)
            ->assertJsonPath('errors.0.row', 3);
        $this->assertSame(1, Client::count());

        $this->upload('clients', $this->csv($file), ['commit' => 1])->assertUnprocessable();
        $this->upload('clients', $this->csv($file), ['commit' => 1, 'skip_invalid' => 1])->assertCreated()->assertJsonPath('created', 1);
        $this->assertSame(2, $this->user->clients()->count());
    }

    public function test_invoices_import_creates_missing_clients_and_derives_overdue(): void
    {
        $this->travelTo(now('UTC')->setTime(12, 0));
        $past = now()->subDays(10)->toDateString();
        $issued = now()->subDays(40)->toDateString();
        $future = now()->addDays(10)->toDateString();
        $file = "invoice_number;client_email;client_name;amount;issue_date;due_date;status\n"
            ."A-1;new@client.test;New Co;1,200.50;$issued;$past;sent\n"
            ."A-2;new@client.test;New Co;99;$issued;$future;\n"
            ."A-3;new@client.test;;-5;$issued;$future;sent\n"
            ."A-1;other@client.test;Other;10;$issued;$future;sent\n"
            ."A-4;nobody@client.test;;10;2026-02-30;$future;sent\n";

        $res = $this->upload('invoices', $this->csv($file), ['commit' => 1, 'skip_invalid' => 1])->assertCreated();

        $res->assertJsonPath('created', 2)->assertJsonPath('clients_created', 1)->assertJsonPath('error_count', 3);
        $a1 = Invoice::where('invoice_number', 'A-1')->sole();
        $this->assertSame('overdue', $a1->status->value);
        $this->assertSame('1200.50', $a1->amount);
        $this->assertSame('GBP', $a1->currency);
        $this->assertSame('sent', Invoice::where('invoice_number', 'A-2')->sole()->status->value);
    }

    public function test_missing_columns_and_non_csv_rejected(): void
    {
        $this->upload('invoices', $this->csv("invoice_number,amount\nX,1\n"))
            ->assertUnprocessable()->assertJsonValidationErrors('file');

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        $this->upload('clients', $this->csv($png, 'sneaky.csv'))
            ->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->upload('clients', $this->csv("name\nA\n", 'data.exe'))
            ->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_import_only_sees_own_data(): void
    {
        $other = User::factory()->create();
        Client::factory()->for($other)->create(['email' => 'shared@x.test']);
        Invoice::factory()->for(Client::factory()->for($other))->create(['user_id' => $other->id, 'invoice_number' => 'Z-1']);
        $d = now()->toDateString();

        $this->upload('invoices', $this->csv("invoice_number,client_email,client_name,amount,issue_date,due_date\nZ-1,shared@x.test,Mine,5,$d,$d\n"), ['commit' => 1])
            ->assertCreated()->assertJsonPath('clients_created', 1);
        $this->assertSame(1, $this->user->clients()->count());
    }
}
