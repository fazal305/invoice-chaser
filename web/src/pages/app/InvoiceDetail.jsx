import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Alert, Button, Card, ConfirmDialog, LinkButton, LoadState, Skeleton, StatusBadge } from '../../components/ui'
import { ActivityTimeline, UpcomingReminders } from '../../components/ActivityTimeline'
import { api, errorMessage } from '../../lib/api'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { useDocumentTitle, useResource } from '../../hooks/useResource'
import NotFound from '../public/NotFound'

const ACTIONS = {
  paid: { label: 'Mark as paid', variant: 'primary' },
  sent: { label: 'Mark as sent', variant: 'primary' },
  draft: { label: 'Restore as draft', variant: 'secondary' },
  cancelled: { label: 'Cancel invoice', variant: 'secondary' },
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(location.state?.saved ? { tone: 'success', text: 'Invoice saved.' } : null)
  const [busyStatus, setBusyStatus] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const invoice = useResource((signal) => api.get(`/invoices/${id}`, { signal }).then((r) => r.data), [id])
  useDocumentTitle(invoice.data ? `Invoice ${invoice.data.data.invoice_number}` : 'Invoice')

  async function changeStatus(status) {
    setBusyStatus(status)
    setNotice(null)
    try {
      const res = await api.post(`/invoices/${id}/status`, { status })
      invoice.setData((d) => ({ ...d, data: res.data.data }))
      invoice.reload()
      const messages = {
        paid: 'Marked as paid. Any pending reminders were stopped.',
        sent: res.data.data.status === 'overdue' ? 'Marked as sent. It is already past due, so it is now overdue.' : 'Marked as sent. Reminders will follow the chase schedule.',
        cancelled: 'Invoice cancelled. No more reminders will be sent.',
        draft: 'Restored as a draft.',
      }
      setNotice({ tone: 'success', text: messages[status] })
    } catch (err) {
      setNotice({ tone: 'error', text: err.response?.data?.errors?.status?.[0] || errorMessage(err) })
    } finally {
      setBusyStatus(null)
      setConfirm(null)
    }
  }

  async function remove() {
    setBusyStatus('delete')
    try {
      await api.delete(`/invoices/${id}`)
      navigate('/app/invoices', { replace: true })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
      setBusyStatus(null)
      setConfirm(null)
    }
  }

  if (invoice.status === 404 && !invoice.loading) return <NotFound inApp />

  return (
    <LoadState
      resource={invoice}
      label="Loading invoice"
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      {({ data: inv, activity, upcoming }) => {
        const editable = !['paid', 'cancelled'].includes(inv.status)
        const reopen = inv.status === 'paid'
        return (
          <>
            <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
              <Link to="/app/invoices" className="hover:text-ink hover:underline">Invoices</Link> <span aria-hidden="true">/</span> {inv.invoice_number}
            </nav>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold sm:text-3xl">{inv.invoice_number}</h1>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="mt-1 font-display text-3xl font-semibold tabular">{formatMoney(inv.amount, inv.currency)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {inv.allowed_statuses.map((s) => {
                  const a = reopen && s === 'sent' ? { label: 'Reopen (not paid)', variant: 'secondary' } : ACTIONS[s]
                  return (
                    <Button key={s} variant={a.variant} busy={busyStatus === s} onClick={() => (s === 'cancelled' ? setConfirm('cancel') : changeStatus(s))}>
                      {a.label}
                    </Button>
                  )
                })}
                {editable && <LinkButton to={`/app/invoices/${inv.id}/edit`} variant="secondary">Edit</LinkButton>}
                <Button variant="ghost" className="text-danger" onClick={() => setConfirm('delete')}>Delete</Button>
              </div>
            </div>

            {notice && <Alert tone={notice.tone} className="mb-6">{notice.text}</Alert>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <Card>
                <h2 className="text-lg font-semibold">Details</h2>
                <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
                  <dt className="text-muted">Client</dt>
                  <dd className="min-w-0">
                    <p className="font-semibold">{inv.client.name}</p>
                    <p className="text-muted">{[inv.client.email, inv.client.phone].filter(Boolean).join(' · ')}</p>
                  </dd>
                  <dt className="text-muted">Issued</dt>
                  <dd className="tabular">{formatDate(inv.issue_date)}</dd>
                  <dt className="text-muted">Due</dt>
                  <dd className="tabular">{formatDate(inv.due_date)}</dd>
                  {inv.paid_at && (
                    <>
                      <dt className="text-muted">Paid</dt>
                      <dd>{formatDateTime(inv.paid_at)}</dd>
                    </>
                  )}
                  <dt className="text-muted">Schedule</dt>
                  <dd>{inv.chase_sequence?.name || 'Default schedule'}</dd>
                  <dt className="text-muted">Payment link</dt>
                  <dd className="min-w-0 break-all">
                    {inv.payment_url ? <a href={inv.payment_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">{inv.payment_url}</a> : <span className="text-muted">Default from Settings</span>}
                  </dd>
                  {inv.notes && (
                    <>
                      <dt className="text-muted">Notes</dt>
                      <dd className="whitespace-pre-line">{inv.notes}</dd>
                    </>
                  )}
                </dl>
              </Card>
              <Card aria-labelledby="activity-heading">
                <h2 id="activity-heading" className="mb-4 text-lg font-semibold">Reminder activity</h2>
                <UpcomingReminders upcoming={upcoming} />
                <ActivityTimeline invoice={inv} activity={activity} />
              </Card>
            </div>

            <ConfirmDialog
              open={confirm === 'cancel'}
              title="Cancel this invoice?"
              confirmLabel="Cancel invoice"
              busy={busyStatus === 'cancelled'}
              onConfirm={() => changeStatus('cancelled')}
              onCancel={() => setConfirm(null)}
            >
              No more reminders will be sent for {inv.invoice_number}. You can restore it as a draft later.
            </ConfirmDialog>
            <ConfirmDialog open={confirm === 'delete'} title={`Delete ${inv.invoice_number}?`} confirmLabel="Delete invoice" busy={busyStatus === 'delete'} onConfirm={remove} onCancel={() => setConfirm(null)}>
              This permanently removes the invoice and its reminder history.
            </ConfirmDialog>
          </>
        )
      }}
    </LoadState>
  )
}
