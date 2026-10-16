import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Alert, Button, Field } from '../../components/ui'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useDocumentTitle } from '../../hooks/useResource'

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export default function Register() {
  useDocumentTitle('Create account')
  const { signIn, status } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', company_name: '', email: '', password: '', password_confirmation: '', terms: false })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (status === 'authed') return <Navigate to="/app" replace />

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Enter your name.'
    if (!form.company_name.trim()) next.company_name = 'Enter your business name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (form.password.length < 10) next.password = 'Use at least 10 characters.'
    else if (!/[a-z]/i.test(form.password) || !/\d/.test(form.password)) next.password = 'Include at least one letter and one number.'
    if (form.password_confirmation !== form.password) next.password_confirmation = "Passwords don't match."
    if (!form.terms) next.terms = 'You need to accept the terms to continue.'
    return next
  }

  async function submit(e) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const res = await api.post('/auth/register', { ...form, email: form.email.trim(), timezone: browserTimezone() })
      signIn(res.data.token, res.data.user)
      navigate('/app', { replace: true })
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      setFormError(Object.keys(fe).length ? null : errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">We&apos;ll set up a starter reminder schedule you can edit.</p>

      {formError && (
        <Alert tone="error" className="mt-6">
          {formError}
        </Alert>
      )}

      <form noValidate onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Your name" autoComplete="name" required value={form.name} onChange={set('name')} error={errors.name} />
        <Field label="Business name" autoComplete="organization" required value={form.company_name} onChange={set('company_name')} error={errors.company_name} hint="Shown on every reminder your clients receive." />
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={errors.email} />
        <Field label="Password" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} error={errors.password} hint="At least 10 characters, with a letter and a number." />
        <Field label="Confirm password" type="password" autoComplete="new-password" required value={form.password_confirmation} onChange={set('password_confirmation')} error={errors.password_confirmation} />

        <div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={form.terms} onChange={set('terms')} className="mt-0.5 size-4 accent-brand" aria-invalid={errors.terms ? true : undefined} aria-describedby={errors.terms ? 'terms-error' : undefined} />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="font-semibold text-brand underline">Terms</Link> and{' '}
              <Link to="/privacy" target="_blank" className="font-semibold text-brand underline">Privacy Policy</Link>, and confirm I have a lawful basis to contact the clients I add.
            </span>
          </label>
          {errors.terms && <p id="terms-error" className="mt-1 text-xs font-medium text-danger">{errors.terms}</p>}
        </div>

        <Button type="submit" busy={busy} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand underline-offset-2 hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
