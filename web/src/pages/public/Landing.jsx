import { LinkButton } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useResource'

const EXAMPLE_STEPS = [
  { when: '3 days before due', channel: 'Email', text: 'Friendly heads-up with the payment link' },
  { when: 'On the due date', channel: 'Email', text: '“Due today” reminder' },
  { when: '7 days overdue', channel: 'Email', text: 'Firmer follow-up with days overdue' },
  { when: '14 days overdue', channel: 'SMS', text: 'Short text nudge, with opt-out' },
]

const FEATURES = [
  { title: 'Your schedule, your words', body: 'Build chase schedules step by step and write each message with placeholders like {client_name} and {amount_due}.' },
  { title: 'Stops the moment they pay', body: 'Mark an invoice paid and every pending reminder for it is cancelled — before and at send time.' },
  { title: 'A clear paper trail', body: 'Every invoice keeps a timeline of what was sent, when, and whether it was delivered or opened.' },
  { title: 'Bring what you have', body: 'Add invoices by hand or import clients and invoices from a CSV export of your accounting tool.' },
]

export default function Landing() {
  useDocumentTitle(null)
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Accounts receivable, on autopilot</p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Stop chasing invoices.
            <br />
            <span className="text-brand">Let the schedule do it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Invoice Chaser tracks what you&apos;re owed and sends polite, well-timed email and SMS reminders on a schedule you control — then stops as soon as an invoice is paid.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton to="/register" className="min-h-12 px-6 text-base">Create a free account</LinkButton>
            <LinkButton to="/login" variant="secondary" className="min-h-12 px-6 text-base">Sign in</LinkButton>
          </div>
        </div>

        <figure className="min-w-0 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_0_#e2ded4,0_20px_40px_-24px_rgba(27,31,35,0.25)]">
          <figcaption className="flex items-baseline justify-between gap-4">
            <span className="font-display text-lg font-semibold">Example chase schedule</span>
            <span className="text-xs text-muted">Illustration</span>
          </figcaption>
          <ol className="mt-5 space-y-0">
            {EXAMPLE_STEPS.map((step, i) => (
              <li key={step.when} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                {i < EXAMPLE_STEPS.length - 1 && <span aria-hidden="true" className="absolute left-[0.70rem] top-6 h-[calc(100%-1rem)] w-px bg-line-strong" />}
                <span aria-hidden="true" className={`mt-1 size-6 rounded-full border-2 ${i < 2 ? 'border-brand bg-brand-tint' : 'border-st-overdue bg-st-overdue-bg'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {step.when} <span className="ml-1 rounded bg-sunken px-1.5 py-0.5 text-xs font-medium text-muted">{step.channel}</span>
                  </p>
                  <p className="text-sm text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </figure>
      </section>

      <section className="border-t border-line bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">What it does</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="min-w-0 rounded-xl border border-line bg-surface p-5">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
