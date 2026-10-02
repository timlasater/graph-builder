import { expect, test } from '@playwright/test'

test('first imported row can be excluded and warning count opens quality details', async ({ page }) => {
  await page.goto('/')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles({
    name: 'quality.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('X,X\n1,2\n3,4\n'),
  })

  await page.getByRole('button', { name: 'View data table' }).click()
  const firstRowExcluded = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="__excluded"]')
  await firstRowExcluded.getByRole('button', { name: 'Exclude row 1' }).click()
  await expect(firstRowExcluded.getByRole('button', { name: 'Include row 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Close data table' }).click()

  await expect(page.getByRole('region', { name: 'Graph preview' })).toContainText('1 source row')
  await page.getByRole('button', { name: 'View 1 data warning' }).click()
  await expect(page.getByRole('dialog', { name: 'quality' })).toBeVisible()
  await expect(page.getByText('Duplicate heading “X” was renamed.')).toBeVisible()
})
