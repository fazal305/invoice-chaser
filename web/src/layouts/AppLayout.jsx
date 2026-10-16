import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { LogoMark, Wordmark } from '../components/Logo'
import { OfflineBanner } from '../components/OfflineBanner'
import { Button, ErrorState, Skeleton } from '../components/ui'
import { NotificationsMenu } from '../components/NotificationsMenu'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/app', label: 'Dashboard', end: true, icon: 'M3 12h7V3H3zm11 9h7v-9h-7zM3 21h7v-5H3zm11-12h7V3h-7z' },
  { to: '/app/invoices', label: 'Invoices', icon: 'M7 3h8l4 4v14H7zM14 3v5h5M10 12h6M10 16h6' },
  { to: '/app/clients', label: 'Clients', icon: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8' },
  { to: '/app/sequences', label: 'Chase schedules', short: 'Schedules', icon: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0' },
  { to: '/app/import', label: 'Import CSV', desktopOnly: true, icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3' },
  { to: '/app/settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1' },
]

function NavIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function RequireAuth({ children }) {
  const { status, retry, expired } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6" aria-busy="true">
        <span className="sr-only" role="status">Loading your account…</span>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (status === 'unreachable') {
    return (
      <div className="mx-auto max-w-lg p-6 pt-20">
        <ErrorState title="Can't reach Invoice Chaser" message="We couldn't contact the server to restore your session. Check your connection and try again." onRetry={retry} />
      </div>
    )
  }
  if (status !== 'authed') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search, expired }} />
  }
  return children
}

export default function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="hidden border-r border-line bg-surface/70 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link to="/app" className="px-5 py-5" aria-label="Invoice Chaser dashboard">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-tint text-brand-strong' : 'text-muted hover:bg-sunken hover:text-ink'}`
              }
            >
              <NavIcon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <p className="truncate text-sm font-semibold">{user?.company_name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <Button variant="ghost" className="mt-2 -ml-2 px-2 min-h-8" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 lg:pb-0">
        <OfflineBanner />
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur sm:px-6">
          <Link to="/app" className="lg:hidden" aria-label="Invoice Chaser dashboard">
            <LogoMark />
          </Link>
          <p className="hidden truncate text-sm text-muted lg:block">{user?.company_name}</p>
          <div className="flex items-center gap-2">
            <NotificationsMenu />
            <Button variant="ghost" className="lg:hidden" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface lg:hidden">
        {NAV.filter((i) => !i.desktopOnly).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`
            }
          >
            <NavIcon d={item.icon} />
            <span className="truncate">{item.short || item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
