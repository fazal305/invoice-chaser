<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Api\ClientController;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CsvImporter
{
    public const MAX_ROWS = 5000;

    public const COLUMNS = [
        'clients' => ['required' => ['name'], 'optional' => ['email', 'phone', 'sms_opt_out']],
        'invoices' => [
            'required' => ['invoice_number', 'client_email', 'amount', 'issue_date', 'due_date'],
            'optional' => ['client_name', 'currency', 'status', 'payment_url', 'notes'],
        ],
    ];

    public function __construct(private User $user, private string $type) {}

    /** @return array{header: list<string>, rows: list<array{line: int, data: array<string, string>}>} */
    public function parse(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'rb');
        $first = fgets($handle);
        if ($first === false) {
            throw ValidationException::withMessages(['file' => 'The file is empty.']);
        }
        $delimiter = substr_count($first, ';') > substr_count($first, ',') ? ';' : ',';
        rewind($handle);

        $header = null;
        $rows = [];
        $line = 0;
        while (($cells = fgetcsv($handle, 0, $delimiter, '"', '')) !== false) {
            $line++;
            if ($cells === [null] || implode('', array_map('trim', $cells)) === '') {
                continue;
            }
            if ($header === null) {
                $cells[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $cells[0]);
                $header = array_map(fn ($h) => str_replace([' ', '-'], '_', strtolower(trim((string) $h))), $cells);

                continue;
            }
            if (count($rows) >= self::MAX_ROWS) {
                fclose($handle);
                throw ValidationException::withMessages(['file' => 'Files can have at most '.self::MAX_ROWS.' rows. Split it and import in parts.']);
            }
            $data = [];
            foreach ($header as $i => $key) {
                $data[$key] = trim((string) ($cells[$i] ?? ''));
            }
            $rows[] = ['line' => $line, 'data' => $data];
        }
        fclose($handle);

        $missing = array_diff(self::COLUMNS[$this->type]['required'], $header ?? []);
        if ($header === null || $missing) {
            throw ValidationException::withMessages([
                'file' => 'Missing required column'.(count($missing) === 1 ? '' : 's').': '.implode(', ', $missing ?: self::COLUMNS[$this->type]['required']).'. Download the template to see the expected format.',
            ]);
        }
        if (! $rows) {
            throw ValidationException::withMessages(['file' => 'The file has a header row but no data rows.']);
        }

        return ['header' => $header, 'rows' => $rows];
    }

    /** @return array{valid: list<array>, errors: list<array{row: int, messages: list<string>}>} */
    public function validate(array $rows): array
    {
        return $this->type === 'clients' ? $this->validateClients($rows) : $this->validateInvoices($rows);
    }

    private function validateClients(array $rows): array
    {
        $existing = $this->user->clients()->whereNotNull('email')->pluck('email')->map(fn ($e) => strtolower($e))->flip();
        $seen = [];
        $valid = [];
        $errors = [];

        foreach ($rows as $row) {
            $d = $row['data'];
            $d['email'] = strtolower($d['email'] ?? '') ?: null;
            $d['phone'] = preg_replace('/[\s()\-]/', '', $d['phone'] ?? '') ?: null;
            $v = Validator::make($d, [
                'name' => ['required', 'string', 'max:160'],
                'email' => ['nullable', 'required_without:phone', 'email:rfc', 'max:254'],
                'phone' => ['nullable', 'required_without:email', 'regex:'.ClientController::PHONE_REGEX],
                'sms_opt_out' => ['nullable', Rule::in(['', '0', '1', 'yes', 'no', 'true', 'false'])],
            ], ['phone.regex' => 'Phone must be in international format, e.g. +923001234567.']);

            $messages = $v->errors()->all();
            if ($d['email'] && (isset($existing[$d['email']]) || isset($seen[$d['email']]))) {
                $messages[] = "A client with email {$d['email']} already exists.";
            }
            if ($d['email']) {
                $seen[$d['email']] = true;
            }

            if ($messages) {
                $errors[] = ['row' => $row['line'], 'messages' => $messages];
            } else {
                $valid[] = [
                    'name' => $d['name'],
                    'email' => $d['email'],
                    'phone' => $d['phone'],
                    'sms_opt_out' => in_array(strtolower($d['sms_opt_out'] ?? ''), ['1', 'yes', 'true'], true),
                ];
            }
        }

        return ['valid' => $valid, 'errors' => $errors];
    }

    private function validateInvoices(array $rows): array
    {
        $existingNumbers = $this->user->invoices()->pluck('invoice_number')->flip();
        $clientsByEmail = $this->user->clients()->whereNotNull('email')->get(['id', 'email', 'name'])->keyBy(fn ($c) => strtolower($c->email));
        $seen = [];
        $valid = [];
        $errors = [];

        foreach ($rows as $row) {
            $d = $row['data'];
            $d['client_email'] = strtolower($d['client_email'] ?? '');
            $d['currency'] = strtoupper($d['currency'] ?? '') ?: $this->user->currency;
            $d['status'] = strtolower($d['status'] ?? '') ?: 'sent';
            $d['amount'] = str_replace([',', ' '], '', $d['amount'] ?? '');
            $d['payment_url'] = ($d['payment_url'] ?? '') ?: null;

            $v = Validator::make($d, [
                'invoice_number' => ['required', 'string', 'max:64', 'regex:/^[\w\-\/.#]+$/u'],
                'client_email' => ['required', 'email:rfc', 'max:254'],
                'client_name' => ['nullable', 'string', 'max:160'],
                'amount' => ['required', 'decimal:0,2', 'gt:0', 'max:9999999999.99'],
                'currency' => ['required', 'regex:/^[A-Z]{3}$/'],
                'issue_date' => ['required', 'date_format:Y-m-d'],
                'due_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:issue_date'],
                'status' => ['required', Rule::in(['draft', 'sent', 'paid'])],
                'payment_url' => ['nullable', 'url:https', 'max:2048'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ], [
                'issue_date.date_format' => 'Issue date must look like 2026-10-31.',
                'due_date.date_format' => 'Due date must look like 2026-10-31.',
                'status.in' => 'Status must be draft, sent or paid.',
            ]);

            $messages = $v->errors()->all();
            $number = $d['invoice_number'] ?? '';
            if ($number !== '' && (isset($existingNumbers[$number]) || isset($seen[$number]))) {
                $messages[] = "Invoice number {$number} already exists.";
            }
            $seen[$number] = true;
            if (! isset($clientsByEmail[$d['client_email']]) && ($d['client_name'] ?? '') === '' && ! $v->errors()->has('client_email')) {
                $messages[] = "No client with email {$d['client_email']} exists — add a client_name column so one can be created.";
            }

            if ($messages) {
                $errors[] = ['row' => $row['line'], 'messages' => $messages];
            } else {
                $valid[] = [
                    'invoice_number' => $number,
                    'client_email' => $d['client_email'],
                    'client_name' => $clientsByEmail[$d['client_email']]->name ?? $d['client_name'],
                    'amount' => number_format((float) $d['amount'], 2, '.', ''),
                    'currency' => $d['currency'],
                    'issue_date' => $d['issue_date'],
                    'due_date' => $d['due_date'],
                    'status' => $d['status'],
                    'payment_url' => $d['payment_url'],
                    'notes' => ($d['notes'] ?? '') ?: null,
                ];
            }
        }

        return ['valid' => $valid, 'errors' => $errors];
    }

    /** @return array{created: int, clients_created: int} */
    public function commit(array $valid): array
    {
        return DB::transaction(function () use ($valid) {
            if ($this->type === 'clients') {
                foreach ($valid as $row) {
                    $this->user->clients()->create($row);
                }

                return ['created' => count($valid), 'clients_created' => count($valid)];
            }

            $clients = $this->user->clients()->whereNotNull('email')->get()->keyBy(fn ($c) => strtolower($c->email));
            $newClients = 0;
            $today = $this->user->localToday()->toDateString();
            foreach ($valid as $row) {
                $client = $clients[$row['client_email']] ?? null;
                if (! $client) {
                    $client = $this->user->clients()->create(['name' => $row['client_name'], 'email' => $row['client_email']]);
                    $clients[$row['client_email']] = $client;
                    $newClients++;
                }
                $status = InvoiceStatus::from($row['status']);
                if ($status === InvoiceStatus::Sent && $row['due_date'] < $today) {
                    $status = InvoiceStatus::Overdue;
                }
                $this->user->invoices()->create([
                    'client_id' => $client->id,
                    'invoice_number' => $row['invoice_number'],
                    'amount' => $row['amount'],
                    'currency' => $row['currency'],
                    'status' => $status,
                    'issue_date' => $row['issue_date'],
                    'due_date' => $row['due_date'],
                    'payment_url' => $row['payment_url'],
                    'notes' => $row['notes'],
                    'paid_at' => $status === InvoiceStatus::Paid ? now() : null,
                ]);
            }

            return ['created' => count($valid), 'clients_created' => $newClients];
        });
    }
}
