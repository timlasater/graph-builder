import { expect, test } from '@playwright/test'

test('compact header keeps the guide, links, and project title reachable', async ({ page }) => {
  await page.goto('/')
  const header = page.locator('.topbar')
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(50)
  const save = (await page.getByRole('button', { name: 'Save PNG' }).boundingBox())!
  const title = (await page.locator('.document-name').boundingBox())!
  const links = (await page.getByRole('navigation', { name: 'Website links' }).boundingBox())!
  const variables = (await page.locator('.toolbar-actions .panel-toggle').first().boundingBox())!
  expect(title.x).toBeGreaterThan(save.x)
  expect(links.x).toBeLessThan(variables.x)

  await page.getByRole('button', { name: 'User guide' }).click()
  const guide = page.getByRole('dialog', { name: 'User guide' })
  await expect(guide.getByRole('heading', { name: 'Graph Builder: a quick guide' })).toBeVisible()
  await expect(guide.locator('img').first()).toHaveJSProperty('complete', true)
  expect(await guide.locator('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await guide.press('Escape')
  await expect(guide).toBeHidden()
})
