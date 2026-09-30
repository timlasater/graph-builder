import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const summary = (violations: { id: string; nodes: { target: string[]; any: { data?: unknown }[] }[] }[]) => violations.map((violation) => ({ id: violation.id, count: violation.nodes.length, nodes: violation.nodes.slice(0, 8).map((node) => ({ target: node.target, detail: node.any[0]?.data })) }))

test('workspace and main dialogs have no detectable WCAG A or AA issues', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Plot setups' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Graph preview' })).toBeVisible()
  const workspace = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(summary(workspace.violations)).toEqual([])
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark')
  const dark = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(summary(dark.violations)).toEqual([])
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('paper')
  const paper = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(summary(paper.violations)).toEqual([])
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('light')

  await page.getByRole('button', { name: 'Projects & export' }).click()
  await expect(page.getByRole('button', { name: 'Close projects' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Export plotted data CSV' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close projects' })).toBeFocused()
  const projects = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(summary(projects.violations)).toEqual([])
  await page.getByRole('button', { name: 'Close projects' }).click()
  await expect(page.getByRole('button', { name: 'Projects & export' })).toBeFocused()

  await page.getByRole('button', { name: 'View data table' }).click()
  const table = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(summary(table.violations)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'View data table' })).toBeFocused()

  await page.locator('.variable-list').getByRole('button', { name: 'Prototype' }).click()
  await page.getByRole('button', { name: 'Filter selected column' }).click()
  const filter = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(summary(filter.violations)).toEqual([])
})

test('property dropdown focus is visible and the moving-average window accepts a replacement number', async ({ page }) => {
  await page.goto('/')
  const element = page.getByRole('combobox', { name: 'Element' })
  await element.focus()
  await expect(element).toBeFocused()
  expect(await element.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe('none')
  await element.selectOption('smooth')

  const windowInput = page.getByRole('spinbutton', { name: 'Moving average window' })
  await windowInput.focus()
  await windowInput.fill('')
  await expect(windowInput).toHaveValue('')
  await windowInput.fill('15')
  await expect(windowInput).toHaveValue('15')
  await windowInput.press('Tab')
  await expect(windowInput).toHaveValue('15')

  await windowInput.focus()
  await windowInput.fill('')
  await expect(windowInput).toHaveValue('')
  await windowInput.press('Tab')
  await expect(windowInput).toHaveValue('1')
})
