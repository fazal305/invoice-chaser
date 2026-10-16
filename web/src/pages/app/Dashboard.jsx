import { useState } from 'react'
import { Link } from 'react-router'
import { Card, EmptyState, LinkButton, LoadState, PageHeader, Skeleton } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { useDocumentTitle, useResource } from '../../hooks/useResource'

function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 break-words font-display text-2xl font-semibold tabular xl:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function AgingChart({ aging, currency }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...aging.map((b) => b.amount), 1)
  return (
    <figure className="mt-4">
      <figcaption className="sr-only">Outstanding {currency} by days past due</figcaption>
      <ul className="space-y-3" aria-hidden="true">
        {aging.map((b, i) => (
          <li
            key={b.key}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 text-sm"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="text-muted">{b.label}</span>
            <div className="relative flex min-w-0 items-center gap-2 py-1">
              <div
                className={`h-4 rounded-r-[4px] transition-opacity ${i === 0 ? 'bg-brand/45' : 'bg-brand'} ${hover !== null && hover !== i ? 'opacity-50' : ''}`}
                style={{ width: `${Math.max((b.amount / max) * 85, b.amount > 0 ? 1.5 : 0)}%` }}
              />
              <span className="shrink-0 text-xs font-medium tabular text-ink">{b.amount > 0 ? formatMoney(b.amount, currency) : '—'}</span>
              {hover === i && b.amount > 0 && (
                <span className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-paper shadow">
                  {b.label}: {formatMoney(b.amount, currency)} ({Math.round((b.amount / aging.reduce((s, x) => s + x.amount, 0)) * 100)}%)
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>Outstanding {currency} by age</caption>
        <thead><tr><th scope="col">Age</th><th scope="col">Amount</th></tr></thead>
        <tbody>{aging.map((b) => <tr key={b.key}><th scope="row">{b.label}</th><td>{formatMoney(b.amount, currency)}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}

function ChaseOutcome({ chase }) {
  if (!chase.chased) {
    return <p className="mt-4 text-sm text-muted">No reminders have been sent yet. Results appear here once invoices start being chased.</p>
  }
  const paidPct = (chase.paid / chase.chased) * 100
  return (
    <div className="mt-4">
      <p className="font-display text-3xl font-semibold tabular">{chase.success_rate}%</p>
      <p className="text-sm text-muted">of chased invoices have been paid</p>
      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded" role="img" aria-label={`${chase.paid} paid and ${chase.chased - chase.paid} not paid, of ${chase.chased} chased invoices`}>
        {chase.paid > 0 && <div className="bg-brand" style={{ width: `${paidPct}%` }} />}
        {chase.chased - chase.paid > 0 && <div className="flex-1 bg-line-strong" />}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-muted">Chased</dt><dd className="font-semibold tabular">{chase.chased}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="size-2 rounded-sm bg-brand" />Paid</dt><dd className="font-semibold tabular">{chase.paid}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-muted"><span aria-hidden="true" className="size-2 rounded-sm bg-line-strong" />Still open</dt><dd className="font-semibold tabular">{chase.open}</dd></div>
      </dl>
    </div>
  )
}

const RECENT_LABEL = { sent: 'Sent', delivered: 'Delivered', opened: 'Opened', failed: 'Failed', bounced: 'Bounced' }

export default function Dashboard() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const dash = useResource((signal) => api.get('/dashboard', { signal }).then((r) => r.data), [])

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} description="Where your receivables stand today." actions={<LinkButton to="/app/invoices/new">New invoice</LinkButton>} />
      <LoadState
        resource={dash}
        label="Loading dashboard"
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
            <Skeleton className="h-64 sm:col-span-2" />
            <Skeleton className="h-64 sm:col-span-2" />
          </div>
        }
      >
        {(d) => {
          const primary = d.outstanding.find((o) => o.currency === d.currency) || d.outstanding[0]
          const others = d.outstanding.filter((o) => o !== primary)
          if (!primary && !d.chase.chased) {
            return (
              <EmptyState
                title="Nothing outstanding"
                action={<><LinkButton to="/app/invoices/new">Add an invoice</LinkButton><LinkButton to="/app/import" variant="secondary">Import from CSV</LinkButton></>}
              >
                Once you add invoices marked as sent, your outstanding total, overdue amounts and reminder results appear here.
              </EmptyState>
            )
          }
          const cur = primary?.currency || d.currency
          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Total outstanding" value={formatMoney(primary?.total || 0, cur)} sub={`${primary?.count || 0} open invoice${primary?.count === 1 ? '' : 's'}${others.length ? ` · plus ${others.map((o) => formatMoney(o.total, o.currency)).join(', ')}` : ''}`} />
                <Stat label="Overdue" value={formatMoney(primary?.overdue_total || 0, cur)} sub={`${primary?.overdue_count || 0} invoice${primary?.overdue_count === 1 ? '' : 's'} past due`} />
                <Stat label="Average days overdue" value={d.avg_days_overdue ?? '—'} sub="Across all overdue invoices" />
                <Stat label="Reminders, last 30 days" value={d.reminders_30d.sent} sub={`${d.reminders_30d.delivered} delivered · ${d.reminders_30d.opened} opened${d.reminders_30d.failed ? ` · ${d.reminders_30d.failed} failed` : ''}`} />
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Card>
                  <h2 className="text-lg font-semibold">Outstanding by age</h2>
                  <p className="text-sm text-muted">Open {cur} invoices, by days past their due date.</p>
                  <AgingChart aging={d.aging} currency={cur} />
                </Card>
                <Card>
                  <h2 className="text-lg font-semibold">Chased vs. paid</h2>
                  <ChaseOutcome chase={d.chase} />
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <h2 className="text-lg font-semibold">Needs attention</h2>
                  {d.needs_attention.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">No overdue invoices. Nice.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line">
                      {d.needs_attention.map((i) => (
                        <li key={i.id}>
                          <Link to={`/app/invoices/${i.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand">
                            <span className="min-w-0">
                              <span className="font-semibold">{i.invoice_number}</span>
                              <span className="block truncate text-muted">{i.client_name} · due {formatDate(i.due_date)}</span>
                            </span>
                            <span className="shrink-0 font-semibold tabular">{formatMoney(i.amount, i.currency)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card>
                  <h2 className="text-lg font-semibold">Recent reminders</h2>
                  {d.recent.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">No reminders sent yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-line">
                      {d.recent.map((r) => (
                        <li key={r.id}>
                          <Link to={`/app/invoices/${r.invoice_id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand">
                            <span className="min-w-0">
                              <span className="font-semibold">{r.invoice_number}</span> · {r.channel === 'sms' ? 'SMS' : 'Email'}
                              <span className="block truncate text-muted">{r.recipient}</span>
                            </span>
                            <span className="shrink-0 text-right text-xs">
                              <span className={['failed', 'bounced'].includes(r.status) ? 'font-semibold text-danger' : 'font-semibold'}>{RECENT_LABEL[r.status]}</span>
                              <span className="block text-muted">{formatDateTime(r.at)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          )
        }}
      </LoadState>
    </>
  )
}
