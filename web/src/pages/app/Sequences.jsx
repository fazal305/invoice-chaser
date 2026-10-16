import { useState } from 'react'
import { Alert, Button, ConfirmDialog, EmptyState, LinkButton, LoadState, PageHeader } from '../../components/ui'
import { api, errorMessage } from '../../lib/api'
import { timingLabel } from '../../lib/templates'
import { useDocumentTitle, useResource } from '../../hooks/useResource'

export default function Sequences() {
  useDocumentTitle('Chase schedules')
  const sequences = useResource((signal) => api.get('/chase-sequences', { signal }).then((r) => r.data.data), [])
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(null)
  const [deleting, setDeleting] = useState(null)

  async function makeDefault(seq) {
    setBusy(`default-${seq.id}`)
    try {
      await api.post(`/chase-sequences/${seq.id}/default`)
      setNotice({ tone: 'success', text: `${seq.name} is now your default schedule.` })
      sequences.reload()
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('delete')
    try {
      await api.delete(`/chase-sequences/${deleting.id}`)
      setNotice({ tone: 'success', text: `${deleting.name} was deleted. Its invoices now use your default schedule.` })
      sequences.reload()
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(null)
      setDeleting(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Chase schedules"
        description="When reminders go out, on which channel, and what they say."
        actions={<LinkButton to="/app/sequences/new">New schedule</LinkButton>}
      />
      {notice && <Alert tone={notice.tone} className="mb-4">{notice.text}</Alert>}
      <LoadState resource={sequences} label="Loading schedules">
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="No chase schedules" action={<LinkButton to="/app/sequences/new">Create a schedule</LinkButton>}>
              Without a schedule, no reminders are sent. Create one to start chasing overdue invoices.
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((seq) => (
                <article key={seq.id} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{seq.name}</h2>
                      <p className="text-sm text-muted">
                        {seq.steps.length} step{seq.steps.length === 1 ? '' : 's'} · used by {seq.invoices_count} invoice{seq.invoices_count === 1 ? '' : 's'}
                        {seq.is_default && ' + any without a schedule'}
                      </p>
                    </div>
                    {seq.is_default && <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-strong">Default</span>}
                  </div>
                  <ol className="mt-4 flex-1 space-y-2 border-l-2 border-line pl-4">
                    {seq.steps.map((st) => (
                      <li key={st.id} className="text-sm">
                        <span className="font-medium">{timingLabel(st)}</span>
                        <span className="ml-2 rounded bg-sunken px-1.5 py-0.5 text-xs text-muted">{st.channel === 'sms' ? 'SMS' : 'Email'}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <LinkButton to={`/app/sequences/${seq.id}`} variant="secondary">Edit</LinkButton>
                    {!seq.is_default && (
                      <>
                        <Button variant="ghost" busy={busy === `default-${seq.id}`} onClick={() => makeDefault(seq)}>Make default</Button>
                        <Button variant="ghost" className="text-danger" onClick={() => setDeleting(seq)}>Delete</Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )
        }
      </LoadState>
      <ConfirmDialog open={deleting !== null} title={`Delete ${deleting?.name ?? 'schedule'}?`} confirmLabel="Delete schedule" busy={busy === 'delete'} onConfirm={remove} onCancel={() => setDeleting(null)}>
        Invoices using this schedule will switch to your default schedule. Reminder history is kept.
      </ConfirmDialog>
    </>
  )
}
