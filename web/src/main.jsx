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

const Login = lazy(() => import('./pages/public/Login'))
const Register = lazy(() => import('./pages/public/Register'))
const Settings = lazy(() => import('./pages/app/Settings'))

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
          { index: true, element: <Page><Settings /></Page> },
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
