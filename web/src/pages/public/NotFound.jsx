import { LinkButton } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useResource'

export default function NotFound({ inApp = false }) {
  useDocumentTitle('Page not found')
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-display text-6xl font-bold text-brand">404</p>
      <h1 className="mt-3 text-2xl font-bold">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-muted">The link may be old, or the item may have been deleted.</p>
      <LinkButton to={inApp ? '/app' : '/'} className="mt-6">
        {inApp ? 'Back to dashboard' : 'Go home'}
      </LinkButton>
    </div>
  )
}
