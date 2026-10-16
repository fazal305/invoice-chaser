import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, Button, ConfirmDialog, EmptyState, Field, LoadState, PageHeader } from '../../components/ui'
import { ClientFormDialog } from '../../components/ClientFormDialog'
import { Pagination } from '../../components/Pagination'
import { api, errorMessage } from '../../lib/api'
import { useDebounced, useDocumentTitle, useResource } from '../../hooks/useResource'

export default function Clients() {
  useDocumentTitle('Clients')
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebounced(search.trim(), 300)
  const page = Number(params.get('page') || 1)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const clients = useResource(
    (signal) => api.get('/clients', { params: { q: q || undefined, page }, signal }).then((r) => r.data),
    [q, page],
  )

  function updateSearch(value) {
    setSearch(value)
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    next.delete('page')
    setParams(next, { replace: true })
  }

  async function confirmDelete() {
    setDeleteBusy(true)
    try {
      await api.delete(`/clients/${deleting.id}`)
      setNotice({ tone: 'success', text: `${deleting.name} was deleted.` })
      clients.reload()
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setDeleteBusy(false)
      setDeleting(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="The people and businesses you send invoices to."
        actions={<Button onClick={() => setEditing({})}>New client</Button>}
      />
      {notice && (
        <Alert tone={notice.tone} className="mb-4">
          {notice.text}
        </Alert>
      )}
      <div className="mb-4 max-w-sm">
        <Field label="Search clients" type="search" placeholder="Name or email" value={search} onChange={(e) => updateSearch(e.target.value)} />
      </div>

      <LoadState resource={clients} label="Loading clients">
        {(data) =>
          data.data.length === 0 ? (
            q ? (
              <EmptyState title="No clients match your search" action={<Button variant="secondary" onClick={() => updateSearch('')}>Clear search</Button>}>
                Nothing matched “{q}”. Check the spelling or search by email instead.
              </EmptyState>
            ) : (
              <EmptyState
                title="No clients yet"
                action={
                  <>
                    <Button onClick={() => setEditing({})}>Add your first client</Button>
                    <Link to="/app/import" className="inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold text-brand hover:bg-sunken">Import from CSV</Link>
                  </>
                }
              >
                Add the clients you invoice so Invoice Chaser knows where to send reminders.
              </EmptyState>
            )
          ) : (
            <>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {data.data.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-sm text-muted">
                        {[c.email, c.phone].filter(Boolean).join(' · ')}
                        {c.sms_opt_out && <span className="ml-2 rounded bg-sunken px-1.5 py-0.5 text-xs">SMS opted out</span>}
                      </p>
                    </div>
                    <Link to={`/app/invoices?client_id=${c.id}`} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
                      {c.invoices_count} invoice{c.invoices_count === 1 ? '' : 's'}
                      {c.open_invoices_count > 0 && <span className="text-st-overdue"> · {c.open_invoices_count} open</span>}
                    </Link>
                    <div className="flex gap-1">
                      <Button variant="ghost" className="min-h-9 px-3" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>Edit</Button>
                      <Button variant="ghost" className="min-h-9 px-3 text-danger" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination meta={data.meta} onPage={(p) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('page', p); return n })} />
            </>
          )
        }
      </LoadState>

      <ClientFormDialog
        open={editing !== null}
        client={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setNotice({ tone: 'success', text: `${saved.name} was saved.` })
          setEditing(null)
          clients.reload()
        }}
      />
      <ConfirmDialog open={deleting !== null} title={`Delete ${deleting?.name ?? 'client'}?`} confirmLabel="Delete client" busy={deleteBusy} onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
        Clients with invoices can&apos;t be deleted — delete their invoices first.
      </ConfirmDialog>
    </>
  )
}
