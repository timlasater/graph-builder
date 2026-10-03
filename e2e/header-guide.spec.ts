import { expect, test } from '@playwright/test'

test('header and bottom links stay reachable', async ({ page }) => {
  await page.goto('/')
  const header = page.locator('.topbar')
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(50)
  const links = page.getByRole('navigation', { name: 'External links' })
  await expect(links.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute('href', 'https://github.com/timlasater/graph-builder')
  await expect(links.getByRole('link', { name: 'Report a problem' })).toHaveAttribute('href', 'https://github.com/timlasater/graph-builder/issues')
  await expect(links.getByRole('link', { name: 'timothylasater.com' })).toHaveAttribute('href', 'https://timothylasater.com/')
  const builder = (await page.locator('.builder-area').boundingBox())!
  const footer = (await links.boundingBox())!
  expect(footer.x + footer.width / 2).toBeCloseTo(builder.x + builder.width / 2, 0)
  expect(footer.y).toBeGreaterThan((await page.locator('.graph-builder-grid').boundingBox())!.y)

  await page.getByRole('button', { name: 'User guide' }).click()
  const guide = page.getByRole('dialog', { name: 'User guide' })
  await expect(guide.getByRole('heading', { name: 'Graph Builder user guide' })).toBeVisible()
  await expect(guide.getByRole('link', { name: 'Keyboard only workflow' })).toHaveAttribute('href', '#keyboard-only-workflow')
  await guide.getByRole('link', { name: 'Keyboard only workflow' }).click()
  await expect(guide.getByRole('heading', { name: 'Keyboard only workflow' })).toBeInViewport()
  await expect(guide.getByText('Tab / Shift+Tab')).toBeVisible()
  await guide.press('Escape')
  await expect(guide).toBeHidden()
})

test('assigned variable chip can be dragged from its blank padding without selecting text', async ({ page }) => {
  await page.goto('/')
  const x = page.locator('.x-zone .assignment-drag-handle')
  await expect(x).toContainText('Input Setting')
  await expect(x).toHaveCSS('user-select', 'none')
  const chip = page.locator('.x-zone .assignment')
  await expect(chip).toHaveCSS('user-select', 'none')
  const start = (await chip.boundingBox())!
  const target = (await page.locator('.y-zone .drop-zone').boundingBox())!
  await page.mouse.move(start.x + 3, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + 13, start.y + start.height / 2, { steps: 4 })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('.y-zone .assignment-drag-handle')).toHaveCount(2)
  await expect(page.locator('.x-zone .assignment-drag-handle')).toHaveCount(0)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
})
