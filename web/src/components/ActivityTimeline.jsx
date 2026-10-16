import { formatDate, formatDateTime } from '../lib/format'

const STATUS_TEXT = {
  queued: { label: 'Queued', tone: 'text-muted' },
  sent: { label: 'Sent', tone: 'text-st-sent' },
  delivered: { label: 'Delivered', tone: 'text-st-paid' },
  opened: { label: 'Opened', tone: 'text-st-paid' },
  failed: { label: 'Failed', tone: 'text-danger' },
  bounced: { label: 'Bounced', tone: 'text-danger' },
  skipped: { label: 'Skipped', tone: 'text-muted' },
  cancelled: { label: 'Stopped', tone: 'text-muted' },
}

export function stepLabel(step) {
  if (!step) return 'Reminder (step removed)'
  if (step.days_offset === 0) return 'On the due date'
  const days = `${step.days_offset} day${step.days_offset === 1 ? '' : 's'}`
  return step.trigger_type === 'before_due' ? `${days} before due` : `${days} overdue`
}

function Dot({ status }) {
  const color = ['failed', 'bounced'].includes(status)
    ? 'border-danger bg-danger-tint'
    : ['delivered', 'opened'].includes(status)
      ? 'border-st-paid bg-st-paid-bg'
      : status === 'sent'
        ? 'border-st-sent bg-st-sent-bg'
        : 'border-line-strong bg-sunken'
  return <span aria-hidden="true" className={`mt-1 size-3.5 shrink-0 rounded-full border-2 ${color}`} />
}

export function ActivityTimeline({ invoice, activity }) {
  const events = [
    ...activity.map((log) => ({ key: `log-${log.id}`, kind: 'log', log, at: log.sent_at || log.created_at })),
    { key: 'created', kind: 'created', at: invoice.created_at },
    ...(invoice.paid_at ? [{ key: 'paid', kind: 'paid', at: invoice.paid_at }] : []),
  ].sort((a, b) => (b.at || '').localeCompare(a.at || ''))

  if (activity.length === 0) {
    return (
      <div className="mt-4">
        <p className="text-sm text-muted">
          {invoice.status === 'draft'
            ? 'No reminders yet. Drafts are not chased — mark the invoice as sent to start its schedule.'
            : ['paid', 'cancelled'].includes(invoice.status)
              ? 'No reminders were sent for this invoice.'
              : 'No reminders sent yet. The first one goes out when its scheduled day arrives.'}
        </p>
        <Timeline events={events.filter((e) => e.kind !== 'log')} />
      </div>
    )
  }

  return <Timeline events={events} />
}

function Timeline({ events }) {
  return (
    <ol className="mt-4 space-y-4">
      {events.map((e) => (
        <li key={e.key} className="flex gap-3">
          {e.kind === 'log' ? <Dot status={e.log.status} /> : <span aria-hidden="true" className={`mt-1 size-3.5 shrink-0 rounded-full border-2 ${e.kind === 'paid' ? 'border-st-paid bg-st-paid' : 'border-ink bg-surface'}`} />}
          <div className="min-w-0 flex-1 text-sm">
            {e.kind === 'created' && (
              <>
                <p className="font-semibold">Invoice added</p>
                <p className="text-muted">{formatDateTime(e.at)}</p>
              </>
            )}
            {e.kind === 'paid' && (
              <>
                <p className="font-semibold text-st-paid">Marked as paid — chasing stopped</p>
                <p className="text-muted">{formatDateTime(e.at)}</p>
              </>
            )}
            {e.kind === 'log' && <LogEntry log={e.log} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

function LogEntry({ log }) {
  const s = STATUS_TEXT[log.status] || { label: log.status, tone: 'text-muted' }
  return (
    <>
      <p className="font-semibold">
        {log.channel === 'sms' ? 'SMS' : 'Email'} reminder · {stepLabel(log.step)}{' '}
        <span className={`font-semibold ${s.tone}`}>— {s.label}</span>
      </p>
      <p className="break-all text-muted">{log.recipient || 'No recipient'}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-muted">
        <li>Scheduled for {formatDate(log.scheduled_for)}</li>
        {log.sent_at && <li>Sent {formatDateTime(log.sent_at)}{log.attempts > 1 ? ` after ${log.attempts} attempts` : ''}</li>}
        {log.delivered_at && <li>Delivered {formatDateTime(log.delivered_at)}</li>}
        {log.opened_at && <li>Opened {formatDateTime(log.opened_at)}</li>}
      </ul>
      {log.error_message && <p className="mt-1 text-xs text-danger">{log.error_message}</p>}
    </>
  )
}
