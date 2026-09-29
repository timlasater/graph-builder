import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('cartesian Plotly bundle renders every graph element and exports images', async ({ page }) => {
  test.setTimeout(90_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  const chart = page.locator('.js-plotly-plot')
  await expect(chart.locator('.main-svg').first()).toBeVisible()

  const element = page.getByRole('combobox', { name: 'Element' })
  for (const [choice, traceType] of [
    ['points', 'scatter'], ['line', 'scatter'], ['bar', 'bar'],
    ['histogram', 'bar'], ['box', 'box'], ['area', 'scatter'],
    ['summary', 'scatter'], ['fit', 'scatter'], ['smooth', 'scatter'],
  ] as const) {
    await element.selectOption(choice)
    await expect.poll(() => chart.evaluate((node) => (node as HTMLElement & { data?: { type: string }[] }).data?.[0]?.type)).toBe(traceType)
    await expect(chart.locator('.main-svg').first()).toBeVisible()
  }

  await element.selectOption('points')
  const dragArea = chart.locator('.draglayer .nsewdrag').first()
  const box = await dragArea.boundingBox()
  expect(box).not.toBeNull()
  await chart.getByRole('button', { name: 'Box Select' }).click()
  await page.mouse.move(box!.x + box!.width * .1, box!.y + box!.height * .1)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * .9, box!.y + box!.height * .9, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByText(/source rows? selected/)).toBeVisible()
  await page.getByRole('button', { name: 'Clear', exact: true }).click()

  const initialRange = await chart.evaluate((node) => (node as HTMLElement & { layout: { xaxis: { range: number[] } } }).layout.xaxis.range)
  await chart.getByRole('button', { name: 'Zoom', exact: true }).click()
  await page.mouse.move(box!.x + box!.width * .25, box!.y + box!.height * .25)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * .75, box!.y + box!.height * .75, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => chart.evaluate((node) => (node as HTMLElement & { layout: { xaxis: { range: number[] } } }).layout.xaxis.range)).not.toEqual(initialRange)

  await element.selectOption('box')
  await page.getByRole('button', { name: 'Projects & export' }).click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download SVG' }).click()
  const svg = await svgDownload
  expect(svg.suggestedFilename()).toMatch(/\.svg$/)
  expect(await readFile(await svg.path(), 'utf8')).toContain('<svg')

  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PNG' }).click()
  const png = await pngDownload
  expect(png.suggestedFilename()).toMatch(/\.png$/)
  expect((await readFile(await png.path())).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  expect(pageErrors).toEqual([])
})
