import { mkdir, readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { expect, test, type Page } from '@playwright/test'

type PlotRow = { series: string; element: string; x: string; y: string; n: string; q1: string; median: string; q3: string; error_lower: string; error_upper: string }
const near = (actual: string, expected: number) => expect(Number(actual)).toBeCloseTo(expected, 6)

async function plottedRows(page: Page) {
  await page.getByRole('button', { name: 'Projects & export' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export plotted data CSV' }).click()
  const csv = await readFile(await (await download).path(), 'utf8')
  await page.getByRole('button', { name: 'Close projects' }).click()
  return Papa.parse<PlotRow>(csv, { header: true, skipEmptyLines: true }).data
}

async function assign(page: Page, column: string, role: string) {
  await page.locator('.variable-list').getByRole('button', { name: column, exact: true }).click()
  await page.getByLabel('Assign selected column to').selectOption(role)
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
}

async function captureGraph(page: Page, name: string) {
  if (process.env.GB_CAPTURE_R_REFERENCE !== '1') return
  await mkdir('test-results/r-browser', { recursive: true })
  await page.locator('.graph-card').screenshot({ path: `test-results/r-browser/${name}.png` })
}

test('browser graph exports match the R 4.6.1 practice-file reference', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles('test-data/r-visual-reference.csv')
  await page.getByRole('button', { name: 'Import selected data' }).click()
  await expect(page.getByRole('region', { name: 'Graph preview' })).toContainText('16 source rows')

  const points = (await plottedRows(page)).filter((row) => row.y !== '')
  expect(points).toHaveLength(15)
  expect(points.some((row) => row.x === '5' && row.y === '30')).toBe(true)
  await captureGraph(page, 'points')

  const element = page.getByRole('combobox', { name: 'Element' })
  await element.selectOption('line')
  const lines = (await plottedRows(page)).filter((row) => row.y !== '')
  expect(lines).toHaveLength(15)
  await captureGraph(page, 'lines')

  await page.getByRole('button', { name: 'Remove X from x' }).click()
  await page.getByRole('button', { name: 'Remove Group from color' }).click()
  await assign(page, 'Group', 'x')
  await element.selectOption('bar')
  await page.getByRole('combobox', { name: 'Error bars' }).selectOption('ci')
  const bars = await plottedRows(page)
  const bar = (group: string) => bars.find((row) => row.x === group)!
  expect(bars).toHaveLength(3)
  near(bar('A').y, 8.5); near(bar('A').error_upper, 7.54406729442298)
  near(bar('B').y, 6.83333333333333); near(bar('B').error_upper, 2.9990121415757)
  near(bar('C').y, 10); expect(bar('C').error_upper).toBe('')
  await captureGraph(page, 'mean-bars')

  await element.selectOption('box')
  const boxes = await plottedRows(page)
  const box = (group: string) => boxes.find((row) => row.x === group)!
  expect(boxes).toHaveLength(3)
  near(box('A').q1, 3.75); near(box('A').median, 6); near(box('A').q3, 8.25)
  near(box('B').q1, 5.25); near(box('B').median, 6.5); near(box('B').q3, 8.5)
  await captureGraph(page, 'box')

  await page.getByRole('button', { name: 'Remove Group from x' }).click()
  await page.getByRole('button', { name: 'Remove Response from y' }).click()
  await assign(page, 'Response', 'x')
  await element.selectOption('histogram')
  await page.getByRole('spinbutton', { name: 'Number of bins' }).fill('5')
  await page.getByRole('spinbutton', { name: 'Number of bins' }).press('Tab')
  const histogram = await plottedRows(page)
  expect(histogram.map((row) => Number(row.y))).toEqual([9, 5, 0, 0, 1])
  await captureGraph(page, 'histogram')

  await page.getByRole('button', { name: 'Remove Response from x' }).click()
  await assign(page, 'X', 'x')
  await assign(page, 'Response', 'y')
  await element.selectOption('fit')
  const fit = await plottedRows(page)
  expect(fit).toHaveLength(2)
  for (const row of fit) near(row.y, -1.0201793721973051 + 3.123318385650225 * Number(row.x))
  await captureGraph(page, 'linear-fit')

  await element.selectOption('smooth')
  const smooth = await plottedRows(page)
  expect(smooth.map((row) => Number(row.x))).toEqual([1, 2, 3, 4, 5])
  for (const [index, expected] of [4.333333333333333, 5.111111111111111, 7.055555555555556, 10.611111111111112, 12.583333333333334].entries()) near(smooth[index].y, expected)
  await captureGraph(page, 'smooth')
})
