import { describe, expect, it } from 'vitest'
import { datasetFromMatrix, inferDataType } from './importData'

describe('tabular data import', () => {
  it('infers common engineering data types', () => {
    expect(inferDataType(['1.2', '3.4', null])).toBe('number')
    expect(inferDataType(['true', 'false'])).toBe('boolean')
    expect(inferDataType(['2025-01-02', '2025-02-03'])).toBe('date')
    expect(inferDataType(['Prototype A', 'Prototype B'])).toBe('text')
  })

  it('creates unique headers and preserves missing values', () => {
    const dataset = datasetFromMatrix([
      ['Result', 'Result', ''],
      ['1.5', '', 'A'],
      ['2.5', '3.5', 'B'],
    ], 'Imported test')

    expect(dataset.columns.map((column) => column.name)).toEqual(['Result', 'Result 2', 'Column 3'])
    expect(dataset.columns[0].dataType).toBe('number')
    expect(dataset.rows[0].values[dataset.columns[1].id]).toBeNull()
    expect(dataset.rows).toHaveLength(2)
    expect(dataset.warnings.map((warning) => warning.code)).toEqual(['duplicate-heading', 'empty-heading'])
  })

  it('warns about mixed values and invalid dates', () => {
    const dataset = datasetFromMatrix([['Recorded'], ['2026-01-01'], ['not-a-date']], 'Dates')
    expect(dataset.warnings.map((warning) => warning.code)).toContain('mixed-types')
    expect(dataset.warnings.map((warning) => warning.code)).toContain('invalid-date')
  })
})
