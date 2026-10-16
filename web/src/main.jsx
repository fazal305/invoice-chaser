import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router'
import './index.css'
import { AuthProvider } from './lib/auth'
import PublicLayout from './layouts/PublicLayout'
import AppLayout, { RequireAuth } from './layouts/AppLayout'
import { SkeletonRows } from './components/ui'
import NotFound from './pages/public/NotFound'
import Landing from './pages/public/Landing'

const Privacy = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.Terms })))
const Faq = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.Faq })))
const Login = lazy(() => import('./pages/public/Login'))
const Register = lazy(() => import('./pages/public/Register'))
const Dashboard = lazy(() => import('./pages/app/Dashboard'))
const Import = lazy(() => import('./pages/app/Import'))
const Settings = lazy(() => import('./pages/app/Settings'))
const Invoices = lazy(() => import('./pages/app/Invoices'))
const InvoiceForm = lazy(() => import('./pages/app/InvoiceForm'))
const InvoiceDetail = lazy(() => import('./pages/app/InvoiceDetail'))
const Clients = lazy(() => import('./pages/app/Clients'))
const Sequences = lazy(() => import('./pages/app/Sequences'))
const SequenceEditor = lazy(() => import('./pages/app/SequenceEditor'))

function Root() {
  return (
    <AuthProvider>
      <ScrollRestoration />
      <Outlet />
    </AuthProvider>
  )
}

function Page({ children }) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="p-1">
          <SkeletonRows rows={4} />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <Landing /> },
          { path: '/login', element: <Page><Login /></Page> },
          { path: '/register', element: <Page><Register /></Page> },
          { path: '/privacy', element: <Page><Privacy /></Page> },
          { path: '/terms', element: <Page><Terms /></Page> },
          { path: '/faq', element: <Page><Faq /></Page> },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        path: '/app',
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Page><Dashboard /></Page> },
          { path: 'invoices', element: <Page><Invoices /></Page> },
          { path: 'invoices/new', element: <Page><InvoiceForm /></Page> },
          { path: 'invoices/:id', element: <Page><InvoiceDetail /></Page> },
          { path: 'invoices/:id/edit', element: <Page><InvoiceForm /></Page> },
          { path: 'clients', element: <Page><Clients /></Page> },
          { path: 'sequences', element: <Page><Sequences /></Page> },
          { path: 'sequences/new', element: <Page><SequenceEditor /></Page> },
          { path: 'sequences/:id', element: <Page><SequenceEditor /></Page> },
          { path: 'import', element: <Page><Import /></Page> },
          { path: 'settings', element: <Page><Settings /></Page> },
          { path: '*', element: <NotFound inApp /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
