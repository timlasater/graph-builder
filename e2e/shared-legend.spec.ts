import { expect, test } from '@playwright/test'

test('multiple layers share an editable legend by default and can opt out', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.interactive-legend-item')).toHaveCount(3)
  await page.evaluate(async () => {
    const { useBuilderStore } = await import('/src/store.ts')
    useBuilderStore.getState().addLayer('box')
  })
  const setting = page.getByRole('checkbox', { name: 'One legend entry per group across layers' })
  await expect(setting).toBeChecked()
  await expect(page.locator('.interactive-legend-item')).toHaveCount(3)
  await expect.poll(() => page.locator('.plotly-chart').evaluate((element) => {
    const data = (element as HTMLElement & { data: { legendgroup: string; showlegend: boolean; marker: { color: string } }[] }).data
    return { count: data.filter((trace) => trace.showlegend).length, colors: data.slice(0, 3).every((trace, index) => trace.marker.color === data[index + 3].marker.color) }
  })).toEqual({ count: 3, colors: true })
  await page.getByRole('button', { name: 'Group A', exact: true }).dblclick()
  await page.getByRole('textbox', { name: 'Rename Group A' }).fill('Control')
  await page.getByRole('textbox', { name: 'Rename Group A' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Control', exact: true })).toBeVisible()
  const exported = await page.evaluate(async () => {
    const { renderGraphImage } = await import('/src/graphExport.ts')
    const url = await renderGraphImage('svg', 1000, 700)
    const doc = new DOMParser().parseFromString(decodeURIComponent(url.split(',')[1]), 'image/svg+xml')
    return Array.from(doc.querySelectorAll('.legendtext')).map((node) => node.textContent)
  })
  expect(exported).toEqual(['Control', 'Group B', 'Group C'])
  await setting.uncheck()
  await expect(page.locator('.interactive-legend-item')).toHaveCount(6)
  await setting.check()
  await expect(page.getByRole('button', { name: 'Control', exact: true })).toBeVisible()
})
