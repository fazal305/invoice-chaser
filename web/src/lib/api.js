import axios from 'axios'

const TOKEN_KEY = 'ic_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8471/api',
  headers: { Accept: 'application/json' },
  timeout: 30000,
})

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage blocked: the session just won't survive a reload
  }
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && getToken()) {
      setToken(null)
      window.dispatchEvent(new CustomEvent('session-expired'))
    }
    return Promise.reject(error)
  },
)

/** Turns any request failure into a short, user-facing sentence. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (axios.isCancel(error)) return null
  if (!error?.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'You appear to be offline. Check your connection and try again.'
    }
    if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.'
    return "We couldn't reach the server. Please try again in a moment."
  }
  const { status, data } = error.response
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return 'That item no longer exists.'
  if (status === 409) return data?.message || 'That change conflicts with existing data.'
  if (status === 413) return 'That file is too large.'
  if (status === 422) return data?.message || 'Please fix the highlighted fields.'
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.'
  return fallback
}

/** Laravel validation errors as { field: 'first message' }. */
export function fieldErrors(error) {
  const errors = error?.response?.status === 422 ? error.response.data?.errors : null
  if (!errors) return {}
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]))
}
