import { Link, Outlet } from 'react-router'
import { Wordmark } from '../components/Logo'
import { useAuth } from '../lib/auth'
import { OfflineBanner } from '../components/OfflineBanner'

const YEAR = new Date().getFullYear()

export default function PublicLayout() {
  const { status } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <OfflineBanner />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" aria-label="Invoice Chaser home">
            <Wordmark />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-1 text-sm font-semibold">
            {status === 'authed' ? (
              <Link to="/app" className="rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-strong">
                Open app
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 hover:bg-sunken">
                  Sign in
                </Link>
                <Link to="/register" className="rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-strong">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted sm:px-6">
          <p>© {YEAR} Invoice Chaser</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-4">
            <Link to="/faq" className="hover:text-ink">FAQ</Link>
            <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            <Link to="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
