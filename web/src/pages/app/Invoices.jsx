import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { EmptyState, Field, LinkButton, LoadState, PageHeader, StatusBadge, Button } from '../../components/ui'
import { Pagination } from '../../components/Pagination'
import { api } from '../../lib/api'
import { formatDate, formatMoney, STATUS_LABELS } from '../../lib/format'
import { useDebounced, useDocumentTitle, useResource } from '../../hooks/useResource'

const FILTERS = ['', 'overdue', 'sent', 'draft', 'paid', 'cancelled']

export default function Invoices() {
  useDocumentTitle('Invoices')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebounced(search.trim(), 300)
  const status = params.get('status') || ''
  const clientId = params.get('client_id') || ''
  const page = Number(params.get('page') || 1)

  const invoices = useResource(
    (signal) => api.get('/invoices', { params: { q: q || undefined, status: status || undefined, client_id: clientId || undefined, page }, signal }).then((r) => r.data),
    [q, status, clientId, page],
  )

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const filtered = Boolean(q || status || clientId)

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Everything you've billed, and where each invoice stands."
        actions={
          <>
            <LinkButton to="/app/import" variant="secondary">Import CSV</LinkButton>
            <LinkButton to="/app/invoices/new">New invoice</LinkButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs">
          <Field label="Search" type="search" placeholder="Invoice number or client" value={search} onChange={(e) => { setSearch(e.target.value); setParam('q', e.target.value.trim()) }} />
        </div>
        <div role="group" aria-label="Filter by status" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f || 'all'}
              type="button"
              aria-pressed={status === f}
              onClick={() => setParam('status', f)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${status === f ? 'bg-ink text-paper' : 'text-muted hover:bg-sunken hover:text-ink'}`}
            >
              {f ? STATUS_LABELS[f] : 'All'}
            </button>
          ))}
        </div>
      </div>
      {clientId && (
        <p className="mb-4 text-sm text-muted">
          Showing one client&apos;s invoices.{' '}
          <button type="button" className="font-semibold text-brand underline" onClick={() => setParam('client_id', '')}>Show all clients</button>
        </p>
      )}

      <LoadState resource={invoices} label="Loading invoices">
        {(data) =>
          data.data.length === 0 ? (
            filtered ? (
              <EmptyState
                title="No invoices match"
                action={<Button variant="secondary" onClick={() => { setSearch(''); setParams({}) }}>Clear filters</Button>}
              >
                Try a different search or status filter.
              </EmptyState>
            ) : (
              <EmptyState
                title="No invoices yet"
                action={
                  <>
                    <LinkButton to="/app/invoices/new">Add an invoice</LinkButton>
                    <LinkButton to="/app/import" variant="secondary">Import from CSV</LinkButton>
                  </>
                }
              >
                Add an invoice and mark it as sent — reminders start automatically based on its due date.
              </EmptyState>
            )
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-sunken/60 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Invoice</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Client</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Due</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.data.map((inv) => (
                      <tr key={inv.id} className="cursor-pointer hover:bg-paper" onClick={() => navigate(`/app/invoices/${inv.id}`)}>
                        <td className="px-4 py-3 font-semibold">
                          <Link to={`/app/invoices/${inv.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{inv.invoice_number}</Link>
                          {inv.reminders_sent > 0 && <span className="ml-2 text-xs font-normal text-muted">{inv.reminders_sent} reminder{inv.reminders_sent === 1 ? '' : 's'}</span>}
                        </td>
                        <td className="max-w-56 truncate px-4 py-3">{inv.client?.name}</td>
                        <td className="px-4 py-3 tabular">{formatDate(inv.due_date)}</td>
                        <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                        <td className="px-4 py-3 text-right font-semibold tabular">{formatMoney(inv.amount, inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-2 md:hidden">
                {data.data.map((inv) => (
                  <li key={inv.id}>
                    <Link to={`/app/invoices/${inv.id}`} className="block rounded-xl border border-line bg-surface p-4 hover:bg-paper">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{inv.invoice_number}</p>
                          <p className="truncate text-sm text-muted">{inv.client?.name}</p>
                        </div>
                        <p className="shrink-0 font-semibold tabular">{formatMoney(inv.amount, inv.currency)}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                        <StatusBadge status={inv.status} />
                        <span className="text-muted tabular">Due {formatDate(inv.due_date)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination meta={data.meta} onPage={(p) => setParam('page', String(p))} />
            </>
          )
        }
      </LoadState>
    </>
  )
}
