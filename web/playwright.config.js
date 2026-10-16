import { defineConfig, devices } from '@playwright/test'

const API_PORT = 8471
const WEB_PORT = 5471

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `php -S 127.0.0.1:${API_PORT} -t ../api/public ../api/public/index.php`,
      url: `http://127.0.0.1:${API_PORT}/up`,
      reuseExistingServer: true,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
    },
  ],
})
