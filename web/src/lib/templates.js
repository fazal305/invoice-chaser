export const PLACEHOLDERS = [
  { key: 'client_name', label: 'Client name', sample: 'Northwind Traders' },
  { key: 'invoice_number', label: 'Invoice number', sample: 'INV-1042' },
  { key: 'amount_due', label: 'Amount due', sample: '$1,250.00' },
  { key: 'due_date', label: 'Due date', sample: '14 Nov 2026' },
  { key: 'issue_date', label: 'Issue date', sample: '15 Oct 2026' },
  { key: 'days_overdue', label: 'Days overdue', sample: '7' },
  { key: 'payment_link', label: 'Payment link', sample: 'https://pay.example.com/inv-1042' },
  { key: 'company_name', label: 'Your company', sample: 'Your Company' },
]

const KNOWN = new Set(PLACEHOLDERS.map((p) => p.key))

export const SMS_MAX = 459

export function unknownPlaceholders(text) {
  const found = [...String(text || '').matchAll(/\{([a-z_]+)\}/gi)].map((m) => m[1])
  return [...new Set(found.filter((k) => !KNOWN.has(k.toLowerCase())))]
}

/** Returns preview segments so placeholders can be highlighted without building HTML strings. */
export function previewSegments(text, overrides = {}) {
  const values = Object.fromEntries(PLACEHOLDERS.map((p) => [p.key, overrides[p.key] ?? p.sample]))
  const parts = []
  let last = 0
  for (const m of String(text || '').matchAll(/\{([a-z_]+)\}/gi)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    const key = m[1].toLowerCase()
    parts.push(KNOWN.has(key) ? { text: values[key], filled: true } : { text: m[0], unknown: true })
    last = m.index + m[0].length
  }
  if (last < String(text || '').length) parts.push({ text: text.slice(last) })
  return parts
}

export function signedOffset(step) {
  const d = Number(step.days_offset) || 0
  return step.trigger_type === 'before_due' ? -d : d
}

export function timingLabel(step) {
  const d = Number(step.days_offset) || 0
  if (d === 0) return 'On the due date'
  const days = `${d} day${d === 1 ? '' : 's'}`
  return step.trigger_type === 'before_due' ? `${days} before due` : `${days} after due`
}
