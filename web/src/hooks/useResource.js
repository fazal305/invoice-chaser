import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/api'

const SLOW_AFTER_MS = 4000

/**
 * Loads data with loading, slow-network and error states.
 * `fetcher` receives an AbortSignal and must return a promise of the data.
 */
export function useResource(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true, slow: false })
  const [nonce, setNonce] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, slow: false, error: null }))
    const timer = setTimeout(() => setState((s) => (s.loading ? { ...s, slow: true } : s)), SLOW_AFTER_MS)

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false, slow: false })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, error: errorMessage(err), status: err?.response?.status, loading: false, slow: false }))
      })
      .finally(() => clearTimeout(timer))

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), [])

  return { ...state, reload, setData }
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Invoice Chaser` : 'Invoice Chaser'
  }, [title])
}
