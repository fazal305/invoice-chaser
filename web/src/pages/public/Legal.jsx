import { Link } from 'react-router'
import { useDocumentTitle } from '../../hooks/useResource'

const UPDATED = '16 October 2026'
const CONTACT = 'fazalabbas2002@gmail.com'

function Doc({ title, children }) {
  useDocumentTitle(title)
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="text-sm text-muted">Last updated {UPDATED}</p>
      {children}
    </article>
  )
}

export function Privacy() {
  return (
    <Doc title="Privacy Policy">
      <p>Invoice Chaser is a portfolio project that sends payment reminders on behalf of the businesses that use it. This policy explains what it stores and why. It has not been reviewed by a lawyer; if you plan to rely on it for a real business, get proper advice.</p>
      <h2>What we store</h2>
      <ul>
        <li><strong>Account holders:</strong> name, business name, email, a hashed password (bcrypt), timezone, currency, payment terms, payment link and instructions, and an optional logo.</li>
        <li><strong>Your clients:</strong> the name, email address and mobile number you enter or import, and whether they opted out of SMS.</li>
        <li><strong>Invoices and reminders:</strong> invoice numbers, amounts, dates and status, and a log of each reminder: when it was sent, and whether it was delivered or opened as reported by the email/SMS provider.</li>
      </ul>
      <h2>Why</h2>
      <p>Only to run the service: sign you in, show your receivables, and send the reminders you schedule. We don&apos;t sell data, show ads, or use analytics or tracking cookies.</p>
      <h2>Cookies and storage</h2>
      <p>The app doesn&apos;t set cookies. Your sign-in token is kept in your browser&apos;s local storage and is removed when you sign out. Tokens expire after 7 days.</p>
      <h2>Who processes data</h2>
      <p>Reminder emails are delivered through the configured email provider (for example Mailgun) and texts through Twilio. They receive the recipient address and message content to deliver it, and report delivery and open events back.</p>
      <h2>Your clients&apos; rights</h2>
      <p>As the account holder you are responsible for having a lawful basis to contact your clients. Clients can reply STOP to any text to stop SMS reminders, and can reply to any email to reach you directly.</p>
      <h2>Retention and deletion</h2>
      <p>Data is kept until you delete it. Deleting your account in Settings permanently removes your profile, clients, invoices and reminder history.</p>
      <h2>Contact</h2>
      <p>Questions or requests: <a className="text-brand underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </Doc>
  )
}

export function Terms() {
  return (
    <Doc title="Terms of Service">
      <p>By creating an account you agree to these terms. Invoice Chaser is provided as a portfolio project, free of charge and &quot;as is&quot;, without warranties of any kind.</p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Only add clients you have a genuine invoice relationship with and a lawful basis to contact.</li>
        <li>Keep reminder content accurate, polite and lawful. Don&apos;t use the service to harass anyone or to collect debts you aren&apos;t owed.</li>
        <li>Follow the rules that apply to you for business messaging and debt collection, including SMS consent and opt-out rules (such as the TCPA in the US).</li>
        <li>Keep your password safe. You are responsible for activity on your account.</li>
      </ul>
      <h2>Service limits</h2>
      <p>Reminders depend on third-party email and SMS providers and on the scheduler running. We don&apos;t guarantee that any message is delivered or delivered on time, and we aren&apos;t liable for losses from missed, late or duplicate reminders.</p>
      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Settings. We may suspend accounts that break these terms.</p>
      <h2>Contact</h2>
      <p><a className="text-brand underline" href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </Doc>
  )
}

const FAQS = [
  ['When do reminders go out?', 'Once an hour the scheduler checks every open invoice. A reminder is sent on the day its step falls due, after 9:00 in the timezone set in Settings.'],
  ['What happens if I mark an invoice as paid?', 'Chasing stops immediately. Reminders already queued are cancelled, and the sending job re-checks the invoice status right before it sends.'],
  ['What if several reminders were missed?', 'Only the most recent overdue reminder is sent, so a client never gets a pile of messages at once. The earlier ones are logged as skipped. Reminders before or on the due date are only ever sent on their exact day.'],
  ['Which invoices are chased?', 'Invoices marked Sent or Overdue. Drafts, paid and cancelled invoices are never chased.'],
  ['What does "opened" mean?', 'It is reported by the email provider when the recipient’s mail client loads the message. Some mail apps block this, so "delivered" without "opened" doesn’t mean it was ignored.'],
  ['What happens when a reminder fails?', 'It is retried up to 3 times over about 20 minutes. If it still fails you get an alert in the app and by email, and the reason shows on the invoice timeline.'],
  ['Can clients stop SMS reminders?', 'Yes. Every text ends with "Reply STOP to opt out", and replies of STOP are honoured automatically.'],
  ['Can I import from my accounting software?', 'Export your clients or invoices as CSV, then use Import CSV. Every row is checked and you see a preview before anything is saved.'],
]

export function Faq() {
  return (
    <Doc title="Frequently asked questions">
      <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {q}
                <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="!mt-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
      <p className="!mt-8 text-sm text-muted">
        Still stuck? Read the <Link className="text-brand underline" to="/privacy">privacy policy</Link> or email{' '}
        <a className="text-brand underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </Doc>
  )
}
