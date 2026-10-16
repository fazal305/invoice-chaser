import { expect, test } from '@playwright/test'
import { authed, expectNoHorizontalOverflow, isoDays, signUpViaApi, uniqueEmail } from './helpers'

test('register through the form and land on an empty dashboard', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter your name.')).toBeVisible()

  await page.getByLabel('Your name').fill('Playwright Owner')
  await page.getByLabel('Business name').fill('Playwright Co (test)')
  await page.getByLabel('Email').fill(uniqueEmail('register'))
  await page.locator('input[autocomplete="new-password"]').first().fill('playwright-pass-42')
  await page.getByLabel('Confirm password').fill('playwright-pass-42')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText('Nothing outstanding')).toBeVisible()
})

test('create a client and an overdue invoice, then mark it paid', async ({ page, request }) => {
  await signUpViaApi(page, request)
  await page.goto('/app/invoices/new')

  await page.getByRole('button', { name: 'New client' }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Globex (sample)')
  await page.getByRole('dialog').getByLabel('Email').fill('ap@globex.test')
  await page.getByRole('button', { name: 'Add client' }).click()
  await expect(page.getByRole('combobox', { name: 'Client' })).toContainText('Globex (sample)')

  await page.getByLabel('Invoice number').fill('E2E-1')
  await page.getByLabel('Amount').fill('420.50')
  await page.getByLabel('Issue date').fill(isoDays(-40))
  await page.getByLabel('Due date').fill(isoDays(-10))
  await page.getByRole('button', { name: 'Create invoice' }).click()

  await expect(page.getByRole('heading', { name: 'E2E-1' })).toBeVisible()
  await expect(page.getByText('Overdue', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Mark as paid' }).click()
  await expect(page.getByText('Marked as paid. Any pending reminders were stopped.')).toBeVisible()
  await expect(page.locator('main').getByText('Paid', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reopen (not paid)' })).toBeVisible()
})

test('schedule editor rejects unknown placeholders inline', async ({ page, request }) => {
  await signUpViaApi(page, request)
  await page.goto('/app/sequences/new')
  await page.getByLabel('Schedule name').fill('Typos')
  await page.getByLabel('Message').fill('Hello {clientname}')
  await page.getByRole('button', { name: 'Create schedule' }).click()
  await expect(page.getByText('Unknown placeholder: {clientname}.')).toBeVisible()
  await expect(page.getByLabel('Message')).toBeFocused()
})

test('expired session sends you to sign in and back', async ({ page, request }) => {
  const { token, email, password } = await signUpViaApi(page, request)
  await page.goto('/app/clients')
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()

  await authed(request, token).post('/auth/logout')
  await page.getByRole('link', { name: 'Invoices' }).first().click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Your session expired')).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app\/invoices$/)
})

test('public pages render and unknown routes show a 404', async ({ page }) => {
  for (const [path, heading] of [
    ['/', 'Stop chasing invoices.'],
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Service'],
    ['/faq', 'Frequently asked questions'],
    ['/definitely-not-here', "This page doesn't exist"],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
  }
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('no horizontal overflow on any page', async ({ page, request }) => {
    for (const path of ['/', '/login', '/register', '/privacy', '/faq']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForTimeout(300)
      await expectNoHorizontalOverflow(page)
    }

    const { token } = await signUpViaApi(page, request)
    const api = authed(request, token)
    const client = await (await api.post('/clients', { name: 'A very long client name for overflow checks (sample)', email: 'long.address.for.overflow@example-company.test' })).json()
    const inv = await (await api.post('/invoices', { client_id: client.data.id, invoice_number: 'OVERFLOW-0001', amount: '123456.78', currency: 'USD', status: 'sent', issue_date: isoDays(-30), due_date: isoDays(-3), payment_url: 'https://pay.example.com/a/really/long/path/that/should/wrap/nicely' })).json()

    for (const path of ['/app', '/app/invoices', '/app/invoices/new', `/app/invoices/${inv.data.id}`, '/app/clients', '/app/sequences', '/app/sequences/new', '/app/import', '/app/settings']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForTimeout(300)
      await expectNoHorizontalOverflow(page)
    }
  })
})
