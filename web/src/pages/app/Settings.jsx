import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, Card, ConfirmDialog, Field, PageHeader, SelectField, TextareaField } from '../../components/ui'
import { api, errorMessage, fieldErrors, setToken } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { CURRENCIES } from '../../lib/format'
import { useDocumentTitle } from '../../hooks/useResource'

function timezones() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
}

function pick(user) {
  return {
    name: user.name || '',
    company_name: user.company_name || '',
    timezone: user.timezone || 'UTC',
    currency: user.currency || 'USD',
    payment_terms_days: String(user.payment_terms_days ?? 30),
    payment_url: user.payment_url || '',
    payment_instructions: user.payment_instructions || '',
    reply_to_email: user.reply_to_email || '',
  }
}

export default function Settings() {
  useDocumentTitle('Settings')
  const { user, setUser } = useAuth()
  const [form, setForm] = useState(() => pick(user))
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const zones = useMemo(() => {
    const list = timezones()
    return list.includes(form.timezone) ? list : [form.timezone, ...list]
  }, [form.timezone])
  const currencies = CURRENCIES.includes(form.currency) ? CURRENCIES : [form.currency, ...CURRENCIES]

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Enter your name.'
    if (!form.company_name.trim()) next.company_name = 'Enter your business name.'
    const terms = Number(form.payment_terms_days)
    if (!Number.isInteger(terms) || terms < 0 || terms > 365) next.payment_terms_days = 'Enter a whole number of days between 0 and 365.'
    if (form.payment_url && !/^https:\/\/\S+$/i.test(form.payment_url)) next.payment_url = 'Use a full https:// link.'
    if (form.reply_to_email && !/^\S+@\S+\.\S+$/.test(form.reply_to_email)) next.reply_to_email = 'Enter a valid email address.'
    setErrors(next)
    setNotice(null)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const payload = { ...form, payment_terms_days: terms, payment_url: form.payment_url || null, reply_to_email: form.reply_to_email || null, payment_instructions: form.payment_instructions || null }
      const res = await api.put('/profile', payload)
      setUser(res.data.user)
      setNotice({ tone: 'success', text: 'Company profile saved.' })
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Your company details appear on every reminder." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <h2 className="text-lg font-semibold">Company profile</h2>
          {notice && (
            <Alert tone={notice.tone} className="mt-4">
              {notice.text}
            </Alert>
          )}
          <form noValidate onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required value={form.name} onChange={set('name')} error={errors.name} />
            <Field label="Business name" required value={form.company_name} onChange={set('company_name')} error={errors.company_name} />
            <SelectField label="Timezone" value={form.timezone} onChange={set('timezone')} error={errors.timezone} hint="Reminders go out after 9:00 in this timezone.">
              {zones.map((z) => (
                <option key={z} value={z}>{z.replaceAll('_', ' ')}</option>
              ))}
            </SelectField>
            <SelectField label="Default currency" value={form.currency} onChange={set('currency')} error={errors.currency}>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </SelectField>
            <Field label="Payment terms (days)" type="number" inputMode="numeric" min="0" max="365" value={form.payment_terms_days} onChange={set('payment_terms_days')} error={errors.payment_terms_days} hint="Used to suggest due dates on new invoices." />
            <Field label="Reply-to email" type="email" value={form.reply_to_email} onChange={set('reply_to_email')} error={errors.reply_to_email} hint="Where client replies to reminders go." />
            <Field className="sm:col-span-2" label="Default payment link" type="url" placeholder="https://" value={form.payment_url} onChange={set('payment_url')} error={errors.payment_url} hint="Used for {payment_link} when an invoice doesn't have its own link." />
            <TextareaField className="sm:col-span-2" label="Bank / payment instructions" rows={4} value={form.payment_instructions} onChange={set('payment_instructions')} error={errors.payment_instructions} hint="Added to the bottom of email reminders." />
            <div className="sm:col-span-2">
              <Button type="submit" busy={busy}>Save profile</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <LogoCard />
          <DangerZone />
        </div>
      </div>
    </>
  )
}

function LogoCard() {
  const { user, setUser } = useAuth()
  const [src, setSrc] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!user.has_logo) return
    let url
    let active = true
    api
      .get('/profile/logo', { responseType: 'blob' })
      .then((res) => {
        if (!active) return
        url = URL.createObjectURL(res.data)
        setSrc(url)
      })
      .catch(() => active && setError("Couldn't load your logo preview."))
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [user.has_logo, user.logo_version])

  async function upload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG or WebP image.')
      return
    }
    if (file.size > 1024 * 1024) {
      setError('The logo must be 1 MB or smaller.')
      return
    }
    const body = new FormData()
    body.append('logo', file)
    setBusy(true)
    try {
      const res = await api.post('/profile/logo', body)
      setUser({ ...res.data.user, logo_version: Date.now() })
    } catch (err) {
      setError(fieldErrors(err).logo || errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.delete('/profile/logo')
      setUser(res.data.user)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Logo</h2>
      <p className="mt-1 text-sm text-muted">Shown at the top of email reminders. PNG, JPEG or WebP, up to 1 MB.</p>
      <div className="mt-4 flex h-24 items-center justify-center rounded-lg border border-dashed border-line-strong bg-paper p-3">
        {user.has_logo && src ? <img src={src} alt={`${user.company_name} logo`} className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-muted">No logo yet</span>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-medium text-danger">{error}</p>}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} tabIndex={-1} aria-hidden="true" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" busy={busy} onClick={() => inputRef.current?.click()}>
          {user.has_logo ? 'Replace logo' : 'Upload logo'}
        </Button>
        {user.has_logo && (
          <Button variant="ghost" onClick={remove} disabled={busy}>
            Remove
          </Button>
        )}
      </div>
    </Card>
  )
}

function DangerZone() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!password) {
      setError('Enter your password to confirm.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.delete('/profile', { data: { password } })
      setToken(null)
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(fieldErrors(err).password || errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Delete account</h2>
      <p className="mt-1 text-sm text-muted">Permanently removes your company profile, clients, invoices and reminder history.</p>
      <Button variant="secondary" className="mt-4 text-danger" onClick={() => setOpen(true)}>
        Delete account…
      </Button>
      <ConfirmDialog open={open} title="Delete your account?" confirmLabel="Delete everything" busy={busy} onConfirm={confirm} onCancel={() => { setOpen(false); setPassword(''); setError(null) }}>
        <p>This can&apos;t be undone. Scheduled reminders stop immediately.</p>
        <Field className="mt-4" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
      </ConfirmDialog>
    </Card>
  )
}
