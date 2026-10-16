import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Alert, Button, Field } from '../../components/ui'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useDocumentTitle } from '../../hooks/useResource'

export default function Login() {
  useDocumentTitle('Sign in')
  const { signIn, status, expired, clearExpired } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const from = location.state?.from || '/app'
  const showExpired = expired || location.state?.expired

  if (status === 'authed') return <Navigate to={from} replace />

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (!form.email.trim()) next.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Enter your password.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const res = await api.post('/auth/login', { email: form.email.trim(), password: form.password })
      clearExpired()
      signIn(res.data.token, res.data.user)
      navigate(from, { replace: true })
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      setFormError(Object.keys(fe).length ? null : errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Pick up where your reminders left off.</p>

      {showExpired && (
        <Alert tone="warn" className="mt-6" title="Your session expired">
          Sign in again to continue. Nothing you saved was lost.
        </Alert>
      )}
      {formError && (
        <Alert tone="error" className="mt-6">
          {formError}
        </Alert>
      )}

      <form noValidate onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={set('password')} error={errors.password} />
        <Button type="submit" busy={busy} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
