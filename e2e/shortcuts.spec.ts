import { expect, test } from '@playwright/test'

test('question mark opens compact keyboard help and returns focus on close', async ({ page }) => {
  await page.goto('/')
  const projects = page.getByRole('button', { name: 'Projects & export' })
  await projects.focus()
  await page.keyboard.press('Shift+/')
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(help).toBeVisible()
  await expect(help.getByText('Undo / redo outside text fields')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close keyboard shortcuts' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(help).toHaveCount(0)
  await expect(projects).toBeFocused()

  const search = page.getByPlaceholder('Search variables')
  await search.focus()
  await page.keyboard.type('?')
  await expect(search).toHaveValue('?')
  await expect(help).toHaveCount(0)
})
