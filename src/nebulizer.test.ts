import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { importTabularFile } from './importData'
import { summaryStatistics } from './statistics'

const source = process.env.GB_NEBULIZER_CSV

describe.skipIf(!source)('optional real nebulizer dataset validation', () => {
  it('imports every record and preserves independently calculated drug values', async () => {
    const text = await readFile(source!, 'utf8')
    const file = { name: '24.11 Results-summary.csv', text: async () => text } as File
    const [sheet] = await importTabularFile(file)
    const dataset = sheet.dataset
    expect(dataset.rows).toHaveLength(511)
    expect(dataset.columns).toHaveLength(13)
    const drug = dataset.columns.find((column) => column.name === 'Drug (mg)')!
    expect(drug.dataType).toBe('number')
    const imported = dataset.rows.map((row) => Number(row.values[drug.id]))
    const independent = text.trim().split(/\r?\n/).slice(1).map((line) => Number(line.split(',')[10])).filter(Number.isFinite)
    expect(imported.length).toBe(independent.length)
    expect(summaryStatistics(imported).mean).toBeCloseTo(independent.reduce((sum, value) => sum + value, 0) / independent.length, 12)
  })
})
