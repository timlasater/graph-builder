import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'

test('the header-row preview closes with Escape or its close button without importing', async ({ page }) => {
  await page.goto('/')
  const example = page.getByRole('region', { name: 'Graph preview' })
  await expect(example).toContainText('45 source rows')
  const file = { name: 'cancel-preview.csv', mimeType: 'text/csv', buffer: Buffer.from('Notes\nValue\n12\n14\n') }
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles(file)
  await page.getByRole('spinbutton', { name: 'Rows to skip before header' }).fill('1')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Import data' })).toHaveCount(0)
  await expect(example).toContainText('45 source rows')

  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles(file)
  const close = page.getByRole('button', { name: 'Close import data' })
  await expect(close).toHaveCSS('color', 'rgb(49, 68, 77)')
  await expect(close).toHaveCSS('background-color', 'rgb(246, 248, 249)')
  await close.click()
  await expect(page.getByRole('dialog', { name: 'Import data' })).toHaveCount(0)
  await expect(example).toContainText('45 source rows')
})

test('leading rows can be skipped, graph rows use checkboxes, and warning count opens quality details', async ({ page }) => {
  await page.goto('/')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles({
    name: 'quality.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Study results\nRecorded 2026\nX,X\n1,2\n3,4\n'),
  })
  await page.getByRole('spinbutton', { name: 'Rows to skip before header' }).fill('2')
  await expect(page.getByText('Header row: X · X')).toBeVisible()
  await page.getByRole('button', { name: 'Import selected data' }).click()
  await expect(page.getByRole('region', { name: 'Graph preview' })).toContainText('quality. 2 source rows')

  await page.getByRole('button', { name: 'View data table' }).click()
  const firstRowExcluded = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="__excluded"]')
  const firstRowCheckbox = firstRowExcluded.getByRole('checkbox', { name: 'Include row 1 in graph' })
  await expect(firstRowCheckbox).toBeChecked()
  await firstRowCheckbox.uncheck()
  await expect(firstRowCheckbox).not.toBeChecked()
  await page.getByRole('button', { name: 'Close data table' }).click()

  await expect(page.getByRole('region', { name: 'Graph preview' })).toContainText('1 source row')
  await page.getByRole('button', { name: 'View 1 data warning' }).click()
  await expect(page.getByRole('dialog', { name: 'quality' })).toBeVisible()
  await expect(page.getByText('Duplicate heading “X” was renamed.')).toBeVisible()
})

test('Excel worksheet names are readable and skipped rows reveal the chosen header', async ({ page }) => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Notes'], ['Group', 'Value'], ['A', 12]]), 'Results')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Other', 'Value'], ['B', 18]]), 'Other')
  await page.goto('/')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".xlsx"]').first().setInputFiles({ name: 'study.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) })
  const results = page.getByRole('radio', { name: 'Results' })
  await expect(results).toBeChecked()
  await expect(results.locator('..')).toHaveCSS('color', 'rgb(49, 70, 80)')
  await page.getByRole('spinbutton', { name: 'Rows to skip before header' }).fill('1')
  await expect(page.getByText('Header row: Group · Value')).toBeVisible()
  await page.getByRole('button', { name: 'Import selected data' }).click()
  await expect(page.getByRole('region', { name: 'Graph preview' })).toContainText('1 source row')
  await page.getByRole('button', { name: 'View data table' }).click()
  await expect(page.getByRole('dialog', { name: 'study · Results' })).toContainText('1 of 1 rows')
  await expect(page.getByRole('columnheader', { name: 'Group' })).toBeVisible()
})

test('a small-sample statistics warning can be dismissed', async ({ page }) => {
  await page.goto('/')
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"][accept*=".csv"]').first().setInputFiles({ name: 'single.csv', mimeType: 'text/csv', buffer: Buffer.from('Group,Value\nA,12\n') })
  await page.getByRole('button', { name: 'Import selected data' }).click()
  await expect(page.getByRole('region', { name: 'Graph preview' })).toContainText('single. 1 source row')
  await page.locator('.variable-list').getByRole('button', { name: 'Value' }).click()
  await page.getByLabel('Assign selected column to').selectOption('y')
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  await page.getByRole('button', { name: /Bars$/ }).first().click()
  await page.getByLabel('Error bars').selectOption('sd')
  await expect(page.getByText(/fewer than two observations/)).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss graph warning' }).click()
  await expect(page.getByText(/fewer than two observations/)).toHaveCount(0)
})
