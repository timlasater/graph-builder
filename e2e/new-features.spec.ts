import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function importCsv(page: Page, name: string) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles({ name, mimeType: 'text/csv', buffer: await readFile(`examples/${name}`) })
  await page.getByRole('button', { name: 'Import selected data' }).click()
}

async function assign(page: Page, column: string, role: 'x' | 'y') {
  const assigned = page.locator(`.${role}-zone button[aria-label^="Remove"]`)
  while (await assigned.count()) await assigned.first().click()
  await page.locator('.variable-list').getByRole('button', { name: column, exact: true }).click()
  await page.getByLabel('Assign selected column to').selectOption(role)
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
}

test('paired comparison reports a result for matched subjects', async ({ page }) => {
  await page.goto('/')
  await importCsv(page, 'paired-study.csv')
  await assign(page, 'Visit', 'x'); await assign(page, 'Response', 'y')
  const comparison = page.locator('.property-section').filter({ has: page.getByRole('button', { name: 'Compare groups' }) })
  await comparison.getByRole('button', { name: 'Add comparison' }).click()
  await comparison.getByRole('combobox', { name: 'Test' }).selectOption('paired')
  await comparison.getByRole('combobox', { name: 'Subject ID' }).selectOption({ label: 'Subject' })
  await expect(comparison.locator('.comparison-result')).toContainText('p ')
  await expect.poll(() => page.locator('.plotly-chart').evaluate((node) => (node as HTMLElement & { layout?: { annotations?: { text: string }[] } }).layout?.annotations?.some((annotation) => annotation.text.includes('95% CI')))).toBe(true)
})

test('nonlinear curve fit shows parameters and residuals', async ({ page }) => {
  await page.goto('/')
  await importCsv(page, 'dose-response.csv')
  await assign(page, 'Dose', 'x'); await assign(page, 'Response', 'y')
  await page.getByRole('combobox', { name: 'Element' }).selectOption('nonlinear')
  await expect(page.locator('.curve-fit-results')).toContainText('EC50')
  await expect(page.getByRole('img', { name: 'Residuals by X value' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Show equation' }).check()
  await page.getByRole('checkbox', { name: 'Show sample size' }).check()
  await page.getByRole('checkbox', { name: 'Show R²' }).check()
  await expect.poll(() => page.locator('.plotly-chart').evaluate((node) => (node as HTMLElement & { layout?: { annotations?: { text: string }[] } }).layout?.annotations?.some((annotation) => annotation.text.includes('ŷ =') && annotation.text.includes('n = 8') && annotation.text.includes('R² =')))).toBe(true)
  await expect.poll(() => page.locator('.plotly-chart').evaluate((node) => (node as HTMLElement & { data?: { mode?: string; x?: number[] }[] }).data?.[0]?.x?.length)).toBe(150)
})

test('figure layout combines saved graphs in a PNG and project file', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Projects & export' }).click()
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Duplicate open graph' }).click()
  await page.getByRole('button', { name: 'Open layout' }).click()
  const choices = page.locator('.figure-layout-choices input[type="checkbox"]')
  await expect(choices).toHaveCount(4)
  for (let index = 0; index < 3; index++) {
    await page.locator('.figure-layout-choices input[type="checkbox"]:not(:checked)').first().click()
    await expect(page.locator('.figure-layout-choices input[type="checkbox"]:checked')).toHaveCount(index + 2)
  }
  await expect(page.locator('.figure-layout-panel .plotly-chart')).toHaveCount(4)
  await expect.poll(() => page.locator('.figure-layout-panel .plotly-chart').evaluateAll((nodes) => nodes.every((node) => Boolean((node as HTMLElement & { data?: unknown[] }).data?.length)))).toBe(true)
  await expect.poll(() => page.locator('.figure-layout-panel .plotly-chart').evaluateAll((nodes) => nodes.every((node) => ((node as HTMLElement & { _fullLayout?: { _size?: { h?: number } } })._fullLayout?._size?.h ?? 0) > 120))).toBe(true)
  const originalOrder = await page.locator('.figure-layout-panel').evaluateAll((panels) => panels.map((panel) => (panel as HTMLElement).dataset.graphId))
  const handles = page.locator('.figure-layout-drag-handle')
  await handles.nth(3).dragTo(handles.first())
  await expect(page.locator('.figure-layout-panel').first()).toHaveAttribute('data-graph-id', originalOrder[3]!)
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download figure PNG' }).click()
  const png = await pngDownload
  expect((await readFile(await png.path())).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download project' }).click()
  const saved = JSON.parse(await readFile(await (await projectDownload).path(), 'utf8'))
  expect(saved.figureLayout.graphIds).toHaveLength(4)
  expect(saved.figureLayout.graphIds[0]).toBe(originalOrder[3])
})
