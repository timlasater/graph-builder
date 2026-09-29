import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', channel: 'chrome', headless: true, launchOptions: { args: ['--disable-gpu', '--no-sandbox'] } },
  timeout: 30_000,
})
