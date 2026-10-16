import { useRef, useState } from 'react'
import { Alert, Button, Card, LinkButton, PageHeader } from '../../components/ui'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import { useDocumentTitle } from '../../hooks/useResource'

const TYPES = {
  invoices: {
    label: 'Invoices',
    required: 'invoice_number, client_email, amount, issue_date, due_date',
    optional: 'client_name (creates the client if new), currency, status (draft/sent/paid), payment_url, notes',
  },
  clients: {
    label: 'Clients',
    required: 'name, and email or phone',
    optional: 'sms_opt_out (yes/no)',
  },
}

export default function Import() {
  useDocumentTitle('Import CSV')
  const [type, setType] = useState('invoices')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const inputRef = useRef(null)

  function reset(nextType = type) {
    setType(nextType)
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function send(commit) {
    const body = new FormData()
    body.append('file', file)
    if (commit) {
      body.append('commit', '1')
      body.append('skip_invalid', '1')
    }
    return api.post(`/import/${type}`, body)
  }

  async function check(selected) {
    setFile(selected)
    setPreview(null)
    setResult(null)
    setError(null)
    if (!selected) return
    if (!/\.(csv|txt)$/i.test(selected.name)) {
      setError('Choose a .csv file.')
      return
    }
    if (selected.size > 2 * 1024 * 1024) {
      setError('The file must be 2 MB or smaller.')
      return
    }
    setBusy('check')
    try {
      const body = new FormData()
      body.append('file', selected)
      const res = await api.post(`/import/${type}`, body)
      setPreview(res.data)
    } catch (err) {
      setError(fieldErrors(err).file || errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function commit() {
    setBusy('commit')
    setError(null)
    try {
      const res = await send(true)
      setResult(res.data)
      setPreview(null)
    } catch (err) {
      setError(fieldErrors(err).file || errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const spec = TYPES[type]

  return (
    <>
      <PageHeader title="Import from CSV" description="Bring in clients and invoices from your accounting tool or a spreadsheet." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <div role="group" aria-label="What are you importing?" className="inline-flex rounded-lg border border-line bg-paper p-1">
            {Object.entries(TYPES).map(([key, t]) => (
              <button key={key} type="button" aria-pressed={type === key} onClick={() => reset(key)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${type === key ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-paper px-6 py-10 text-center hover:border-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => check(e.target.files?.[0] || null)} />
            <span className="font-semibold">{file ? file.name : `Choose a ${spec.label.toLowerCase()} CSV file`}</span>
            <span className="mt-1 text-sm text-muted">{busy === 'check' ? 'Checking rows…' : 'Up to 2 MB and 5,000 rows. We check every row before anything is saved.'}</span>
          </label>

          {error && <Alert tone="error" className="mt-4">{error}</Alert>}

          {result && (
            <Alert
              tone="success"
              className="mt-4"
              title={`Imported ${result.created} ${type === 'invoices' ? 'invoice' : 'client'}${result.created === 1 ? '' : 's'}`}
              action={<LinkButton to={`/app/${type}`} variant="secondary">View {spec.label.toLowerCase()}</LinkButton>}
            >
              {type === 'invoices' && result.clients_created > 0 && `${result.clients_created} new client${result.clients_created === 1 ? ' was' : 's were'} created. `}
              {result.error_count > 0 && `${result.error_count} row${result.error_count === 1 ? ' was' : 's were'} skipped because of errors.`}
            </Alert>
          )}

          {preview && (
            <div className="mt-5 space-y-4">
              <p className="text-sm">
                <strong>{preview.valid_count}</strong> of {preview.total_rows} rows are ready to import
                {preview.error_count > 0 && <>, <strong className="text-danger">{preview.error_count}</strong> {preview.error_count === 1 ? "has" : "have"} problems</>}.
              </p>
              {preview.valid_count > 0 && (
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <caption className="sr-only">First rows to be imported</caption>
                    <thead className="bg-sunken/60 text-xs uppercase tracking-wide text-muted">
                      {type === 'invoices' ? (
                        <tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Amount</th></tr>
                      ) : (
                        <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Phone</th></tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-line">
                      {preview.preview.map((r, i) =>
                        type === 'invoices' ? (
                          <tr key={i}><td className="px-3 py-2 font-medium">{r.invoice_number}</td><td className="px-3 py-2">{r.client_name}</td><td className="px-3 py-2 tabular">{r.due_date}</td><td className="px-3 py-2 text-right tabular">{formatMoney(r.amount, r.currency)}</td></tr>
                        ) : (
                          <tr key={i}><td className="px-3 py-2 font-medium">{r.name}</td><td className="px-3 py-2">{r.email || '—'}</td><td className="px-3 py-2">{r.phone || '—'}</td></tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {preview.errors.length > 0 && (
                <details className="rounded-lg border border-danger/30 bg-danger-tint p-3 text-sm" open={preview.valid_count === 0}>
                  <summary className="cursor-pointer font-semibold text-danger">Rows with problems</summary>
                  <ul className="mt-2 space-y-1">
                    {preview.errors.map((e) => (
                      <li key={e.row}><span className="font-semibold">Line {e.row}:</span> {e.messages.join(' ')}</li>
                    ))}
                  </ul>
                  {preview.error_count > preview.errors.length && <p className="mt-2 text-muted">Showing the first {preview.errors.length} problems.</p>}
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={commit} busy={busy === 'commit'} disabled={preview.valid_count === 0}>
                  Import {preview.valid_count} {preview.valid_count === 1 ? 'row' : 'rows'}{preview.error_count > 0 ? ' and skip the rest' : ''}
                </Button>
                <Button variant="ghost" onClick={() => reset()}>Choose another file</Button>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Format</h2>
          <p className="mt-2 text-sm"><span className="font-medium">Required columns:</span> {spec.required}</p>
          <p className="mt-2 text-sm text-muted"><span className="font-medium text-ink">Optional:</span> {spec.optional}</p>
          <p className="mt-2 text-sm text-muted">Dates use YYYY-MM-DD. The first row must be the column names.</p>
          <a href={`/templates/${type}-template.csv`} download className="mt-4 inline-flex text-sm font-semibold text-brand underline">
            Download {spec.label.toLowerCase()} template
          </a>
        </Card>
      </div>
    </>
  )
}
