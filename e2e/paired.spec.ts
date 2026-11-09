import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('a paired plot connects each subject and saves its ID column', async ({ page }) => {
  await page.goto('/')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles({
    name: 'paired-study.csv', mimeType: 'text/csv',
    buffer: await readFile('examples/paired-study.csv'),
  })
  await page.getByRole('button', { name: 'Import selected data' }).click()
  for (const [column, role] of [['Visit', 'x'], ['Response', 'y']] as const) {
    await page.locator('.variable-list').getByRole('button', { name: column, exact: true }).click()
    await page.getByLabel('Assign selected column to').selectOption(role)
    await page.getByRole('button', { name: 'Assign', exact: true }).click()
  }
  await page.getByRole('combobox', { name: 'Element' }).selectOption('paired')
  await page.getByRole('combobox', { name: 'Subject ID' }).selectOption({ label: 'Subject' })
  await expect.poll(() => page.locator('.plotly-chart').evaluate((element) => {
    const chart = element as HTMLElement & { data?: { mode?: string; x?: string[]; y?: number[] }[] }
    return chart.data?.map((trace) => ({ mode: trace.mode, x: trace.x, y: trace.y }))
  })).toEqual([
    { mode: 'lines+markers', x: ['Before', 'After'], y: [12, 18] },
    { mode: 'lines+markers', x: ['Before', 'After'], y: [15, 20] },
    { mode: 'lines+markers', x: ['Before', 'After'], y: [11, 12] },
    { mode: 'lines+markers', x: ['Before', 'After'], y: [14, 13] },
  ])
  await page.getByRole('button', { name: 'Projects & export' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download project' }).click()
  const saved = JSON.parse(await readFile(await (await download).path(), 'utf8'))
  expect(saved.graphs[0].spec.layers[0]).toMatchObject({ element: 'paired', pairId: expect.any(String) })
})
