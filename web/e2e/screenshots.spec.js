import { execFileSync } from 'node:child_process'
import { test } from '@playwright/test'
import { authed, isoDays, signUpViaApi } from './helpers'

// Regenerates README and social preview images from a freshly seeded sample account.
// Run with: SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate screenshots')

const OUT = '../docs/screenshots'

const CLIENTS = [
  ['Northwind Traders (sample)', 'ap@northwind.test', '+15550100101'],
  ['Contoso Design (sample)', 'billing@contoso.test', null],
  ['Fabrikam Studio (sample)', 'finance@fabrikam.test', '+15550100103'],
  ['Tailspin Labs (sample)', 'accounts@tailspin.test', null],
  ['Wingtip Media (sample)', 'pay@wingtip.test', null],
]

const INVOICES = [
  ['INV-1040', 0, '1250.00', -16],
  ['INV-1041', 1, '2400.00', -45],
  ['INV-1042', 2, '860.00', -8],
  ['INV-1043', 3, '3200.00', 3],
  ['INV-1044', 4, '540.00', -72],
  ['INV-1045', 0, '1750.00', 21],
  ['INV-1046', 1, '980.00', -3],
]

test('capture screenshots', async ({ page, request }) => {
  test.setTimeout(180_000)
  const { token, user } = await signUpViaApi(page, request, { name: 'Sample Owner', company_name: 'Ledgerline Studio (sample)' })
  const api = authed(request, token)

  const ids = []
  for (const [name, email, phone] of CLIENTS) {
    ids.push((await (await api.post('/clients', { name, email, phone })).json()).data.id)
  }
  const invoiceIds = []
  for (const [number, c, amount, due] of INVOICES) {
    const res = await api.post('/invoices', {
      client_id: ids[c], invoice_number: number, amount, currency: 'USD', status: 'sent',
      issue_date: isoDays(due - 30), due_date: isoDays(due), payment_url: `https://pay.example.com/${number.toLowerCase()}`,
    })
    invoiceIds.push((await res.json()).data.id)
  }
  const paidRes = await api.post('/invoices', { client_id: ids[2], invoice_number: 'INV-1039', amount: '640.00', currency: 'USD', status: 'sent', issue_date: isoDays(-50), due_date: isoDays(-20) })
  const paidId = (await paidRes.json()).data.id

  execFileSync('php', ['artisan', 'chase:run', '--now', `--user=${user.id}`], { cwd: '../api' })
  execFileSync('php', ['artisan', 'queue:work', '--stop-when-empty'], { cwd: '../api' })
  await api.post(`/invoices/${paidId}/status`, { status: 'paid' })

  await page.setViewportSize({ width: 1280, height: 860 })
  await page.goto('/app')
  await page.getByText('Outstanding by age').waitFor()
  await page.screenshot({ path: `${OUT}/dashboard.png` })

  await page.setViewportSize({ width: 1200, height: 630 })
  await page.goto('/app')
  await page.getByText('Outstanding by age').waitFor()
  await page.screenshot({ path: '../web/public/og-image.png' })

  await page.setViewportSize({ width: 1280, height: 860 })
  await page.goto(`/app/invoices/${invoiceIds[0]}`)
  await page.getByText('Reminder activity').waitFor()
  await page.screenshot({ path: `${OUT}/invoice-timeline.png` })

  await page.goto('/app/invoices')
  await page.getByText('INV-1044').first().waitFor()
  await page.screenshot({ path: `${OUT}/invoices.png` })

  await page.goto('/app/sequences')
  await page.getByRole('link', { name: 'Edit' }).first().click()
  await page.getByText('Preview with sample values').first().waitFor()
  await page.screenshot({ path: `${OUT}/schedule-editor.png` })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app')
  await page.getByText('Total outstanding').waitFor()
  await page.screenshot({ path: `${OUT}/mobile-dashboard.png` })
})
