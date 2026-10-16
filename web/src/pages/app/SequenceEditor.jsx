import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, Card, ErrorState, Field, PageHeader, SelectField, SkeletonRows, TextareaField } from '../../components/ui'
import { api, errorMessage } from '../../lib/api'
import { PLACEHOLDERS, previewSegments, signedOffset, SMS_MAX, timingLabel, unknownPlaceholders } from '../../lib/templates'
import { useAuth } from '../../lib/auth'
import { useDocumentTitle } from '../../hooks/useResource'

let uid = 0
const nextKey = () => `step-${++uid}`

function newStep(previous) {
  const offset = previous ? Math.max(0, signedOffset(previous)) + 7 : 3
  return {
    key: nextKey(),
    trigger_type: 'after_due',
    days_offset: String(offset),
    channel: 'email',
    subject: 'Invoice {invoice_number} is {days_overdue} days overdue',
    template_body: 'Hi {client_name},\n\nInvoice {invoice_number} for {amount_due} was due on {due_date}.\n\nPay here: {payment_link}\n\n{company_name}',
  }
}

function toForm(step) {
  return { ...step, key: nextKey(), days_offset: String(step.days_offset), subject: step.subject || '' }
}

export default function SequenceEditor() {
  const { id } = useParams()
  const editing = Boolean(id)
  useDocumentTitle(editing ? 'Edit schedule' : 'New schedule')
  const navigate = useNavigate()
  const [load, setLoad] = useState({ loading: editing, error: null })
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [steps, setSteps] = useState(() => (editing ? [] : [newStep()]))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!editing) return
    const controller = new AbortController()
    setLoad({ loading: true, error: null })
    api
      .get(`/chase-sequences/${id}`, { signal: controller.signal })
      .then((res) => {
        const s = res.data.data
        setName(s.name)
        setIsDefault(s.is_default)
        setSteps(s.steps.map(toForm))
        setLoad({ loading: false, error: null })
      })
      .catch((err) => {
        if (!controller.signal.aborted) setLoad({ loading: false, error: errorMessage(err) })
      })
    return () => controller.abort()
  }, [id, editing, nonce])

  const updateStep = (key, patch) => setSteps((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  function validate() {
    const next = {}
    if (!name.trim()) next.name = 'Give this schedule a name.'
    if (steps.length === 0) next.steps = 'Add at least one reminder step.'
    const seen = new Map()
    steps.forEach((s, i) => {
      const d = Number(s.days_offset)
      if (!/^\d+$/.test(String(s.days_offset)) || d > 365) next[`steps.${i}.days_offset`] = 'Enter a whole number of days from 0 to 365.'
      else {
        const k = `${signedOffset(s)}|${s.channel}`
        if (seen.has(k)) next[`steps.${i}.days_offset`] = `Another ${s.channel === 'sms' ? 'SMS' : 'email'} step already goes out on this day.`
        seen.set(k, true)
      }
      if (s.channel === 'email' && !s.subject.trim()) next[`steps.${i}.subject`] = 'Email steps need a subject line.'
      if (!s.template_body.trim()) next[`steps.${i}.template_body`] = 'Write the reminder message.'
      if (s.channel === 'sms' && s.template_body.length > SMS_MAX) next[`steps.${i}.template_body`] = `SMS messages must be ${SMS_MAX} characters or fewer.`
      for (const field of ['subject', 'template_body']) {
        const unknown = unknownPlaceholders(s[field])
        if (unknown.length && !next[`steps.${i}.${field}`]) next[`steps.${i}.${field}`] = `Unknown placeholder: {${unknown.join('}, {')}}.`
      }
    })
    return next
  }

  async function save(e) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) {
      setFormError('Please fix the highlighted fields.')
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    const payload = {
      name: name.trim(),
      is_default: isDefault,
      steps: steps.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        trigger_type: Number(s.days_offset) === 0 ? 'after_due' : s.trigger_type,
        days_offset: Number(s.days_offset),
        channel: s.channel,
        subject: s.channel === 'email' ? s.subject.trim() : null,
        template_body: s.template_body.trim(),
      })),
    }
    setBusy(true)
    try {
      if (editing) await api.put(`/chase-sequences/${id}`, payload)
      else await api.post('/chase-sequences', payload)
      navigate('/app/sequences')
    } catch (err) {
      const raw = err.response?.status === 422 ? err.response.data.errors || {} : {}
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v[0]])))
      setFormError(Object.keys(raw).length ? 'Please fix the highlighted fields.' : errorMessage(err))
      setBusy(false)
    }
  }

  if (load.loading) return <div aria-busy="true"><SkeletonRows rows={5} /></div>
  if (load.error) return <ErrorState message={load.error} onRetry={() => setNonce((n) => n + 1)} />

  const ordered = [...steps].sort((a, b) => signedOffset(a) - signedOffset(b))

  return (
    <>
      <PageHeader title={editing ? `Edit ${name || 'schedule'}` : 'New chase schedule'} description="Steps run in order of their timing, relative to each invoice's due date." />
      <form noValidate onSubmit={save} className="space-y-6">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Card className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Schedule name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Standard reminders" />
          <label className="flex items-center gap-3 pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Use as default schedule
          </label>
        </Card>

        {errors.steps && <Alert tone="error">{errors.steps}</Alert>}

        <ol className="space-y-4">
          {ordered.map((step) => {
            const i = steps.indexOf(step)
            return (
              <li key={step.key}>
                <StepEditor
                  step={step}
                  index={i}
                  errors={errors}
                  canRemove={steps.length > 1}
                  onChange={(patch) => updateStep(step.key, patch)}
                  onRemove={() => setSteps((list) => list.filter((s) => s.key !== step.key))}
                />
              </li>
            )
          })}
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSteps((list) => [...list, newStep(ordered[ordered.length - 1])])} disabled={steps.length >= 12}>
            Add step
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => navigate('/app/sequences')}>Cancel</Button>
          <Button type="submit" busy={busy}>{editing ? 'Save schedule' : 'Create schedule'}</Button>
        </div>
      </form>
    </>
  )
}

function StepEditor({ step, index, errors, canRemove, onChange, onRemove }) {
  const { user } = useAuth()
  const subjectRef = useRef(null)
  const bodyRef = useRef(null)
  const lastField = useRef('template_body')
  const err = (f) => errors[`steps.${index}.${f}`]
  const sms = step.channel === 'sms'
  const onDue = Number(step.days_offset) === 0

  function insert(token) {
    const field = sms ? 'template_body' : lastField.current
    const el = field === 'subject' ? subjectRef.current : bodyRef.current
    const value = step[field]
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const text = `{${token}}`
    onChange({ [field]: value.slice(0, start) + text + value.slice(end) })
    setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  const overrides = { company_name: user?.company_name, payment_link: user?.payment_url || undefined }

  return (
    <Card className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{timingLabel(step)} · {sms ? 'SMS' : 'Email'}</h2>
          {canRemove && <Button variant="ghost" className="min-h-8 px-2 text-danger" onClick={onRemove}>Remove step</Button>}
        </div>
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Days" inputMode="numeric" value={step.days_offset} onChange={(e) => onChange({ days_offset: e.target.value.replace(/[^\d]/g, '') })} error={err('days_offset')} />
          <SelectField label="Timing" value={onDue ? 'after_due' : step.trigger_type} onChange={(e) => onChange({ trigger_type: e.target.value })} disabled={onDue} hint={onDue ? '0 days = on the due date' : null}>
            <option value="before_due">before due date</option>
            <option value="after_due">after due date</option>
          </SelectField>
          <fieldset className="col-span-2 sm:col-span-1">
            <legend className="mb-1 text-sm font-medium">Channel</legend>
            <div className="flex rounded-lg border border-line-strong bg-surface p-0.5">
              {['email', 'sms'].map((c) => (
                <label key={c} className={`flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${step.channel === c ? 'bg-ink text-paper' : 'text-muted'}`}>
                  <input type="radio" className="sr-only" name={`channel-${step.key}`} value={c} checked={step.channel === c} onChange={() => onChange({ channel: c })} />
                  {c === 'sms' ? 'SMS' : 'Email'}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {!sms && (
          <Field
            label="Subject"
            ref={subjectRef}
            value={step.subject}
            onFocus={() => (lastField.current = 'subject')}
            onChange={(e) => onChange({ subject: e.target.value })}
            error={err('subject')}
          />
        )}
        <TextareaField
          label="Message"
          rows={sms ? 4 : 8}
          textareaRef={bodyRef}
          value={step.template_body}
          onFocus={() => (lastField.current = 'template_body')}
          onChange={(e) => onChange({ template_body: e.target.value })}
          error={err('template_body')}
          hint={sms ? `${step.template_body.length}/${SMS_MAX} characters. “Reply STOP to opt out” is added automatically.` : 'Plain text. Your logo and payment instructions are added automatically.'}
        />
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted" id={`ph-${step.key}`}>Insert placeholder</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`ph-${step.key}`}>
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(p.key)}
                className="rounded-md border border-line-strong bg-paper px-2 py-1 font-mono text-xs text-ink hover:border-brand hover:bg-brand-tint"
                aria-label={`Insert ${p.label}`}
              >
                {`{${p.key}}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Preview with sample values</p>
        <div className={`rounded-lg border border-line p-4 text-sm ${sms ? 'max-w-xs rounded-2xl bg-sunken' : 'bg-paper'}`}>
          {!sms && (
            <p className="mb-3 border-b border-line pb-3 font-semibold">
              <Segments text={step.subject || '(no subject)'} overrides={overrides} />
            </p>
          )}
          <p className="whitespace-pre-line break-words">
            <Segments text={step.template_body} overrides={overrides} />
            {sms && <span className="text-muted">{'\n'}Reply STOP to opt out.</span>}
          </p>
        </div>
      </div>
    </Card>
  )
}

function Segments({ text, overrides }) {
  return previewSegments(text, overrides).map((part, i) =>
    part.filled ? (
      <mark key={i} className="rounded bg-brand-tint px-0.5 text-brand-strong">{part.text}</mark>
    ) : part.unknown ? (
      <mark key={i} className="rounded bg-danger-tint px-0.5 text-danger">{part.text}</mark>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  )
}
