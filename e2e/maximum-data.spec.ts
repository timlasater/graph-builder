import { expect, test } from '@playwright/test'

test('imports and graphs the 5,000-row / 50,000-cell maximum without losing controls', async ({ page }) => {
  test.setTimeout(60_000)
  const rows = ['X,Y,Group,V1,V2,V3,V4,V5,V6,V7']
  for (let index = 0; index < 5_000; index += 1) rows.push(`${index % 100},${20 + index % 70},${index % 2 ? 'A' : 'B'},${index},${index % 4},${index % 5},${index % 6},${index % 7},${index % 8},${index % 9}`)

  await page.goto('/')
  const started = performance.now()
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles({ name: 'maximum.csv', mimeType: 'text/csv', buffer: Buffer.from(rows.join('\n')) })
  await page.getByRole('button', { name: 'Import selected data' }).click()
  await expect(page.getByRole('region', { name: 'Graph preview' })).toContainText('5000 source rows')
  await expect(page.locator('.js-plotly-plot .main-svg').first()).toBeVisible()
  console.info(`Maximum-size browser import and graph: ${(performance.now() - started).toFixed(0)} ms`)

  await page.getByRole('button', { name: 'View data table' }).click()
  await expect(page.getByRole('dialog', { name: 'maximum' })).toContainText('5000 of 5000 rows')
  await page.getByRole('button', { name: 'Close data table' }).click()
  await expect(page.getByRole('button', { name: 'Projects & export' })).toBeEnabled()
})
