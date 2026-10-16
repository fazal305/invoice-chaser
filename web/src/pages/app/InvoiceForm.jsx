import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert, Button, Card, ErrorState, Field, PageHeader, SelectField, SkeletonRows, TextareaField } from '../../components/ui'
import { ClientFormDialog } from '../../components/ClientFormDialog'
import { api, errorMessage, fieldErrors } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { addDaysIso, CURRENCIES, todayIso } from '../../lib/format'
import { useDocumentTitle, useResource } from '../../hooks/useResource'

function blankInvoice(user) {
  const issue = todayIso()
  return {
    client_id: '',
    invoice_number: '',
    amount: '',
    currency: user.currency || 'USD',
    status: 'sent',
    issue_date: issue,
    due_date: addDaysIso(issue, user.payment_terms_days ?? 30),
    chase_sequence_id: '',
    payment_url: '',
    notes: '',
  }
}

export default function InvoiceForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  useDocumentTitle(editing ? 'Edit invoice' : 'New invoice')
  const { user } = useAuth()
  const navigate = useNavigate()

  const lookups = useResource(
    (signal) =>
      Promise.all([
        api.get('/clients', { params: { all: 1 }, signal }),
        api.get('/chase-sequences', { signal }),
        editing ? api.get(`/invoices/${id}`, { signal }) : Promise.resolve(null),
      ]).then(([c, s, inv]) => ({ clients: c.data.data, sequences: s.data.data, invoice: inv?.data.data ?? null })),
    [id],
  )

  const [form, setForm] = useState(() => blankInvoice(user))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [clientDialog, setClientDialog] = useState(false)
  const [clients, setClients] = useState([])
  const [dueTouched, setDueTouched] = useState(editing)

  useEffect(() => {
    if (!lookups.data) return
    setClients(lookups.data.clients)
    const inv = lookups.data.invoice
    if (inv) {
      setForm({
        client_id: String(inv.client.id),
        invoice_number: inv.invoice_number,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        chase_sequence_id: inv.chase_sequence_id ? String(inv.chase_sequence_id) : '',
        payment_url: inv.payment_url || '',
        notes: inv.notes || '',
      })
    }
  }, [lookups.data])

  const set = (key) => (e) => {
    const value = e.target.value
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'issue_date' && !dueTouched && value) next.due_date = addDaysIso(value, user.payment_terms_days ?? 30)
      return next
    })
    if (key === 'due_date') setDueTouched(true)
  }

  function validate() {
    const next = {}
    if (!form.client_id) next.client_id = 'Choose a client.'
    if (!form.invoice_number.trim()) next.invoice_number = 'Enter the invoice number.'
    else if (!/^[\w\-/.#]+$/.test(form.invoice_number.trim())) next.invoice_number = 'Use letters, numbers, and - / . # only.'
    if (!/^\d+(\.\d{1,2})?$/.test(String(form.amount).trim()) || Number(form.amount) <= 0) next.amount = 'Enter an amount greater than 0, with up to two decimals.'
    if (!form.issue_date) next.issue_date = 'Choose the issue date.'
    if (!form.due_date) next.due_date = 'Choose the due date.'
    else if (form.issue_date && form.due_date < form.issue_date) next.due_date = "The due date can't be before the issue date."
    if (form.payment_url && !/^https:\/\/\S+$/i.test(form.payment_url)) next.payment_url = 'Use a full https:// link.'
    return next
  }

  async function submit(e) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) {
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0)
      return
    }

    const payload = {
      client_id: Number(form.client_id),
      invoice_number: form.invoice_number.trim(),
      amount: String(form.amount).trim(),
      currency: form.currency,
      issue_date: form.issue_date,
      due_date: form.due_date,
      chase_sequence_id: form.chase_sequence_id ? Number(form.chase_sequence_id) : null,
      payment_url: form.payment_url.trim() || null,
      notes: form.notes.trim() || null,
    }
    if (!editing) payload.status = form.status

    setBusy(true)
    try {
      const res = editing ? await api.put(`/invoices/${id}`, payload) : await api.post('/invoices', payload)
      navigate(`/app/invoices/${res.data.data.id}`, { state: { saved: true } })
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(fe)
      setFormError(Object.keys(fe).length ? 'Please fix the highlighted fields.' : errorMessage(err))
      setBusy(false)
    }
  }

  if (lookups.loading) return <div aria-busy="true"><SkeletonRows rows={6} /></div>
  if (lookups.error) return <ErrorState message={lookups.error} onRetry={lookups.reload} />

  const sequences = lookups.data.sequences
  const defaultSeq = sequences.find((s) => s.is_default)
  const currencies = CURRENCIES.includes(form.currency) ? CURRENCIES : [form.currency, ...CURRENCIES]

  return (
    <>
      <PageHeader title={editing ? `Edit ${form.invoice_number || 'invoice'}` : 'New invoice'} description={editing ? null : 'Record an invoice you have issued so it can be chased.'} />
      <Card className="max-w-3xl">
        {formError && <Alert tone="error" className="mb-4">{formError}</Alert>}
        <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {clients.length === 0 ? (
              <Alert tone="info" title="Add a client first" action={<Button variant="secondary" onClick={() => setClientDialog(true)}>New client</Button>}>
                Invoices belong to a client, so reminders know who to contact.
              </Alert>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <SelectField className="min-w-0 flex-1 basis-60" label="Client" required value={form.client_id} onChange={set('client_id')} error={errors.client_id}>
                  <option value="">Choose a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}</option>
                  ))}
                </SelectField>
                <Button variant="secondary" onClick={() => setClientDialog(true)} className={errors.client_id ? 'mb-5' : ''}>New client</Button>
              </div>
            )}
          </div>
          <Field label="Invoice number" required value={form.invoice_number} onChange={set('invoice_number')} error={errors.invoice_number} placeholder="INV-1042" />
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <Field label="Amount" required inputMode="decimal" value={form.amount} onChange={set('amount')} error={errors.amount} placeholder="0.00" inputClassName="tabular" />
            <SelectField label="Currency" value={form.currency} onChange={set('currency')} error={errors.currency}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
          </div>
          <Field label="Issue date" type="date" required value={form.issue_date} onChange={set('issue_date')} error={errors.issue_date} />
          <Field label="Due date" type="date" required value={form.due_date} onChange={set('due_date')} error={errors.due_date} hint={!dueTouched ? `Issue date + ${user.payment_terms_days ?? 30} days (your payment terms).` : null} />
          {!editing && (
            <SelectField label="Status" value={form.status} onChange={set('status')} error={errors.status} hint={form.status === 'draft' ? "Drafts aren't chased until marked sent." : form.status === 'paid' ? 'Already paid — no reminders will be sent.' : 'Reminders follow the chase schedule.'}>
              <option value="sent">Sent to client</option>
              <option value="draft">Draft</option>
              <option value="paid">Already paid</option>
            </SelectField>
          )}
          <SelectField label="Chase schedule" value={form.chase_sequence_id} onChange={set('chase_sequence_id')} error={errors.chase_sequence_id} hint={<>Manage schedules in <Link className="underline" to="/app/sequences">Chase schedules</Link>.</>}>
            <option value="">{defaultSeq ? `Default (${defaultSeq.name})` : 'Default schedule'}</option>
            {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <Field className="sm:col-span-2" label="Payment link" type="url" placeholder={user.payment_url || 'https://'} value={form.payment_url} onChange={set('payment_url')} error={errors.payment_url} hint="Optional. Falls back to the default link in Settings." />
          <TextareaField className="sm:col-span-2" label="Internal notes" rows={3} value={form.notes} onChange={set('notes')} error={errors.notes} hint="Only visible to you." />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" busy={busy}>{editing ? 'Save changes' : 'Create invoice'}</Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </Card>
      <ClientFormDialog
        open={clientDialog}
        client={null}
        onClose={() => setClientDialog(false)}
        onSaved={(c) => {
          setClients((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)))
          setForm((f) => ({ ...f, client_id: String(c.id) }))
          setClientDialog(false)
        }}
      />
    </>
  )
}
