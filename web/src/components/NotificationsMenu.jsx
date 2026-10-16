import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

const POLL_MS = 120000

export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ unread: 0, items: [], error: false })
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications')
      setState({ unread: res.data.unread, items: res.data.data, error: false })
    } catch {
      setState((s) => ({ ...s, error: true }))
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && state.unread > 0) {
      try {
        await api.post('/notifications/read')
        setState((s) => ({ ...s, unread: 0 }))
      } catch {
        // badge stays; next poll retries
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={state.unread ? `Alerts, ${state.unread} new` : 'Alerts'}
        className="relative inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {state.unread > 0 && (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">
            {state.unread > 9 ? '9+' : state.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface shadow-xl">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold">Alerts</p>
          {state.error && state.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Couldn&apos;t load alerts. They&apos;ll refresh automatically.</p>
          ) : state.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No alerts. You&apos;ll be told here if a reminder can&apos;t be delivered.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {state.items.map((n) => (
                <li key={n.id}>
                  <Link to={`/app/invoices/${n.data.invoice_id}`} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-paper">
                    <p className="font-semibold">
                      {n.data.channel === 'sms' ? 'SMS' : 'Email'} reminder failed · {n.data.invoice_number}
                    </p>
                    <p className="break-words text-muted">{n.data.reason}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
