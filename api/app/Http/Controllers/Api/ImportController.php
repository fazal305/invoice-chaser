<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CsvImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ImportController extends Controller
{
    private const TEXT_MIMES = ['text/plain', 'text/csv', 'application/csv', 'text/x-csv', 'application/vnd.ms-excel'];

    public function __invoke(Request $request, string $type): JsonResponse
    {
        abort_unless(in_array($type, ['clients', 'invoices'], true), 404);

        $request->validate([
            'file' => ['required', 'file', 'max:2048', 'extensions:csv,txt'],
            'commit' => ['sometimes', 'boolean'],
            'skip_invalid' => ['sometimes', 'boolean'],
        ], ['file.extensions' => 'Upload a .csv file.', 'file.max' => 'The file must be 2 MB or smaller.']);

        $file = $request->file('file');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        if (! in_array($mime, self::TEXT_MIMES, true)) {
            throw ValidationException::withMessages(['file' => 'That doesn’t look like a CSV text file.']);
        }

        $importer = new CsvImporter($request->user(), $type);
        $parsed = $importer->parse($file);
        $result = $importer->validate($parsed['rows']);

        $summary = [
            'total_rows' => count($parsed['rows']),
            'valid_count' => count($result['valid']),
            'error_count' => count($result['errors']),
            'errors' => array_slice($result['errors'], 0, 100),
            'preview' => array_slice($result['valid'], 0, 5),
        ];

        if (! $request->boolean('commit')) {
            return response()->json($summary);
        }
        if ($result['errors'] && ! $request->boolean('skip_invalid')) {
            return response()->json(['message' => 'Some rows have errors. Fix them or choose to skip invalid rows.'] + $summary, 422);
        }
        if (! $result['valid']) {
            throw ValidationException::withMessages(['file' => 'There are no valid rows to import.']);
        }

        return response()->json($summary + $importer->commit($result['valid']), 201);
    }
}
