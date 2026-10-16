const moneyFormatters = new Map()

export function formatMoney(amount, currency = 'USD') {
  const key = currency || 'USD'
  if (!moneyFormatters.has(key)) {
    try {
      moneyFormatters.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency: key }))
    } catch {
      moneyFormatters.set(key, new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
  }
  return moneyFormatters.get(key).format(Number(amount) || 0)
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Formats a plain YYYY-MM-DD date without shifting it across timezones. */
export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d)
}

export function todayIso() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDaysIso(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Number(days || 0))
  return d.toISOString().slice(0, 10)
}

export const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  overdue: 'Overdue',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'CAD', 'AUD', 'SAR', 'SGD']
