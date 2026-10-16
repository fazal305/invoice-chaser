import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Field } from './ui'
import { api, errorMessage, fieldErrors } from '../lib/api'

const EMPTY = { name: '', email: '', phone: '', sms_opt_out: false }

export function ClientFormDialog({ open, client, onClose, onSaved }) {
  const ref = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setForm(client ? { name: client.name, email: client.email || '', phone: client.phone || '', sms_opt_out: client.sms_opt_out } : EMPTY)
      setErrors({})
      setFormError(null)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, client])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const next = {}
    const email = form.email.trim()
    const phone = form.phone.replace(/[\s()-]/g, '')
    if (!form.name.trim()) next.name = 'Enter the client name.'
    if (!email && !phone) next.email = 'Add an email or a phone number.'
    if (email && !/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.'
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) next.phone = 'Use international format, e.g. +923001234567.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const payload = { name: form.name.trim(), email: email || null, phone: phone || null, sms_opt_out: form.sms_opt_out }
      const res = client ? await api.put(`/clients/${client.id}`, payload) : await api.post('/clients', payload)
      onSaved(res.data.data)
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      setFormError(Object.keys(fe).length ? null : errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby="client-dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <form noValidate onSubmit={submit} className="space-y-4 p-6">
        <h2 id="client-dialog-title" className="text-lg font-semibold">
          {client ? 'Edit client' : 'New client'}
        </h2>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Name" required value={form.name} onChange={set('name')} error={errors.name} autoComplete="off" />
        <Field label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} hint="Used for email reminders." autoComplete="off" />
        <Field label="Mobile phone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="International format, e.g. +923001234567. Used for SMS reminders." autoComplete="off" />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={form.sms_opt_out} onChange={set('sms_opt_out')} />
          <span>This client has opted out of SMS reminders</span>
        </label>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={busy}>{client ? 'Save changes' : 'Add client'}</Button>
        </div>
      </form>
    </dialog>
  )
}
