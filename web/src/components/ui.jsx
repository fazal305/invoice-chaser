import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import { STATUS_LABELS } from '../lib/format'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 min-h-10 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:cursor-not-allowed'

const buttonVariants = {
  primary: 'bg-brand text-white hover:bg-brand-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken',
  ghost: 'text-ink hover:bg-sunken',
  danger: 'bg-danger text-white hover:brightness-95',
}

export function Button({ variant = 'primary', busy = false, className = '', children, onClick, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
      aria-disabled={busy || undefined}
      onClick={(e) => {
        if (busy) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...props}
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function LinkButton({ variant = 'primary', className = '', ...props }) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />
}

export function Spinner({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}

const inputClass =
  'block w-full min-w-0 rounded-lg border bg-surface px-3 min-h-10 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/40'

function FieldShell({ id, label, hint, error, required, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function describedBy(id, hint, error) {
  return [error && `${id}-error`, hint && !error && `${id}-hint`].filter(Boolean).join(' ') || undefined
}

export function Field({ label, hint, error, required, className, inputClassName = '', ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputClass} ${error ? 'border-danger' : 'border-line-strong'} ${inputClassName}`}
        {...props}
      />
    </FieldShell>
  )
}

export function SelectField({ label, hint, error, required, className, children, ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputClass} ${error ? 'border-danger' : 'border-line-strong'}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export function TextareaField({ label, hint, error, required, className, textareaRef, ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={id}
        ref={textareaRef}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputClass} py-2 leading-relaxed ${error ? 'border-danger' : 'border-line-strong'}`}
        {...props}
      />
    </FieldShell>
  )
}

const alertTones = {
  error: 'border-danger/30 bg-danger-tint text-danger',
  warn: 'border-warn/30 bg-warn-tint text-warn',
  success: 'border-brand/30 bg-brand-tint text-brand-strong',
  info: 'border-line-strong bg-surface text-ink',
}

export function Alert({ tone = 'info', title, children, action, className = '' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm ${alertTones[tone]} ${className}`}
    >
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  )
}

/** Renders loading (skeleton), slow-network, and error states around a resource. */
export function LoadState({ resource, skeleton = <SkeletonRows />, label = 'Loading', children }) {
  if (resource.loading) {
    return (
      <div aria-busy="true">
        <span className="sr-only" role="status">
          {label}…
        </span>
        {resource.slow && (
          <Alert tone="warn" className="mb-4">
            This is taking longer than usual. Your connection may be slow — we&apos;re still trying.
          </Alert>
        )}
        {skeleton}
      </div>
    )
  }
  if (resource.error) {
    return <ErrorState message={resource.error} onRetry={resource.reload} />
  }
  return children(resource.data)
}

export function ErrorState({ title = "Couldn't load this", message, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

const statusClasses = {
  draft: 'bg-st-draft-bg text-st-draft',
  sent: 'bg-st-sent-bg text-st-sent',
  overdue: 'bg-st-overdue-bg text-st-overdue',
  paid: 'bg-st-paid-bg text-st-paid',
  cancelled: 'bg-st-cancelled-bg text-st-cancelled line-through decoration-1',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClasses[status] || statusClasses.draft}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className = '', children, ...props }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-5 ${className}`} {...props}>
      {children}
    </section>
  )
}

export function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', tone = 'danger', busy, onConfirm, onCancel }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
      aria-labelledby="confirm-title"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={tone} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
