import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { datasetSignature } from '../src/datasetSignature'
import { sampleDataset } from '../src/sampleData'
import { defaultGraphSpec } from '../src/store'

test('previous browser-saved graphs can be recovered from Projects as templates', async ({ page }) => {
  const saved = JSON.stringify([{ version: 1, id: 'older-graph', name: 'Older dose view', sourceName: sampleDataset.name, sourceSignature: datasetSignature(sampleDataset), spec: defaultGraphSpec(sampleDataset), filters: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' }])
  await page.addInitScript((value) => localStorage.setItem('graph-builder.plot-setups.v1', value), saved)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Plot setups' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Projects & export' }).click()
  const previous = page.getByRole('heading', { name: 'Previous saved graphs' }).locator('..')
  await expect(previous).toContainText('Older dose view')
  const download = page.waitForEvent('download')
  await previous.getByRole('button', { name: 'Download template' }).click()
  const file = await download
  expect(JSON.parse(await readFile(await file.path(), 'utf8'))).toMatchObject({ format: 'graphbuilder-template', name: 'Older dose view' })
  expect(await page.evaluate(() => localStorage.getItem('graph-builder.plot-setups.v1'))).toBe(saved)
})
