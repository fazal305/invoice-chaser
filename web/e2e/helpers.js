import { expect } from '@playwright/test'

export const API = 'http://127.0.0.1:8471/api'

export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@invoice-chaser.test`
}

/** Registers a throwaway account through the API and signs the page in with its token. */
export async function signUpViaApi(page, request, overrides = {}) {
  const password = `Pw${Math.random().toString(36).slice(2, 10)}42`
  const body = {
    name: 'E2E Owner',
    company_name: 'E2E Studio (test)',
    email: uniqueEmail(),
    password,
    password_confirmation: password,
    timezone: 'UTC',
    terms: true,
    ...overrides,
  }
  const res = await request.post(`${API}/auth/register`, { data: body, headers: { Accept: 'application/json' } })
  expect(res.status()).toBe(201)
  const { token, user } = await res.json()
  await page.addInitScript((t) => localStorage.setItem('ic_token', t), token)
  return { token, user, email: body.email, password }
}

export function authed(request, token) {
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  return {
    post: (path, data) => request.post(`${API}${path}`, { data, headers }),
    get: (path) => request.get(`${API}${path}`, { headers }),
  }
}

export function isoDays(offset) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

export async function expectNoHorizontalOverflow(page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(scroll, `page is ${scroll - client}px wider than the viewport`).toBe(client)
}
