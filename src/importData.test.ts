import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { datasetFromMatrix, importTabularFile, inferDataType } from './importData'
import { defaultGraphSpec, useBuilderStore } from './store'

describe('tabular data import', () => {
  it('infers common engineering data types', () => {
    expect(inferDataType(['1.2', '3.4', null])).toBe('number')
    expect(inferDataType(['true', 'false'])).toBe('boolean')
    expect(inferDataType(['2025-01-02', '2025-02-03'])).toBe('date')
    expect(inferDataType(['Group A', 'Group B'])).toBe('text')
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

  it('uses the row after a chosen number of leading rows as the header', async () => {
    const file = new File(['Study results\nRecorded 2026\nGroup,Value\nA,12\nB,18'], 'results.csv', { type: 'text/csv' })
    const [sheet] = await importTabularFile(file, 2)
    expect(sheet.dataset.columns.map((column) => column.name)).toEqual(['Group', 'Value'])
    expect(sheet.dataset.rows).toHaveLength(2)
    expect(sheet.dataset.rows[0].values.value_1).toBe(12)
    await expect(importTabularFile(file, 5)).rejects.toThrow('No header row remains')
  })

  it('omits entirely empty columns without dropping blank-headed columns that contain data', () => {
    const dataset = datasetFromMatrix([
      ['Dose', '', '', 'Pressure', ''],
      [12, null, null, 101, null],
      [14, '', '', 103, ''],
    ], 'Sparse worksheet')

    expect(dataset.columns.map((column) => column.name)).toEqual(['Dose', 'Pressure'])
    expect(dataset.rows[1].values[dataset.columns[1].id]).toBe(103)
    expect(dataset.warnings).toEqual([])
  })

  it('warns about mixed values and invalid dates', () => {
    const dataset = datasetFromMatrix([['Recorded'], ['2026-01-01'], ['not-a-date']], 'Dates')
    expect(dataset.warnings.map((warning) => warning.code)).toContain('mixed-types')
    expect(dataset.warnings.map((warning) => warning.code)).toContain('invalid-date')
  })

  it('imports tagged rows as graph annotations without counting them as measurements', () => {
    const dataset = datasetFromMatrix([
      ['Pressure', 'Dose', 'GB Type', 'GB Axis', 'GB Value', 'GB Minimum', 'GB Maximum', 'GB Label', 'GB Color'],
      [20, 50, '', '', '', '', '', '', ''],
      [30, 55, 'data', '', '', '', '', '', ''],
      ['', '', 'reference-line', 'Y', 52, '', '', 'Target', '#123456'],
      ['', '', 'acceptance-region', 'Y', '', 48, 60, 'Specification', ''],
      ['', '', 'reference-line', 'Y', 'wrong', '', '', '', ''],
    ], 'Inline annotations')
    expect(dataset.rows).toHaveLength(2)
    expect(dataset.columns.map((column) => column.name)).toEqual(['Pressure', 'Dose'])
    expect(dataset.columns[1].dataType).toBe('number')
    expect(dataset.importedAnnotations?.referenceLines).toMatchObject([{ axis: 'y', value: 52, label: 'Target', color: '#123456' }])
    expect(dataset.importedAnnotations?.referenceRegions).toMatchObject([{ min: 48, max: 60, label: 'Specification' }])
    expect(dataset.warnings.map((warning) => warning.code)).toContain('annotation')
    expect(defaultGraphSpec(dataset).referenceLines?.[0].value).toBe(52)
    useBuilderStore.getState().setDataset(dataset)
    expect(useBuilderStore.getState().spec.referenceRegions?.[0].max).toBe(60)
    useBuilderStore.getState().reset()
  })

  it('warns and skips malformed annotation rows without adding them to calculations', () => {
    const dataset = datasetFromMatrix([
      ['Response', 'GB Type', 'GB Axis', 'GB Value', 'GB Minimum', 'GB Maximum', 'GB Color'],
      [10, '', '', '', '', '', ''],
      ['', 'reference-line', 'Y', 5, '', '', 'red'],
      ['', 'acceptance-region', 'Y', '', 8, 3, ''],
    ], 'Invalid annotations')
    expect(dataset.rows).toHaveLength(1)
    expect(dataset.importedAnnotations?.referenceLines).toHaveLength(0)
    expect(dataset.importedAnnotations?.referenceRegions).toHaveLength(0)
    expect(dataset.warnings.filter((warning) => warning.code === 'annotation')).toHaveLength(2)
  })

  it('uses a separate Graph Annotations sheet and targets the chosen data worksheet', async () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Pressure', 'Dose'], [20, 50]]), 'Results')
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Pressure', 'Dose'], [30, 70]]), 'Other')
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ['Type', 'Axis', 'Value', 'Minimum', 'Maximum', 'Label', 'Color', 'Target Sheet'],
      ['reference-line', 'Y', 55, '', '', 'Target', '', 'Results'],
      ['acceptance-region', 'Y', '', 45, 65, 'Acceptable', '#abcdef', ''],
      ['reference-line', 'Y', 'bad', '', '', '', '', 'Results'],
      ['reference-line', 'X', 100, '', '', '', '', 'Missing sheet'],
    ]), 'Graph Annotations')
    const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const file = { name: 'study.xlsx', arrayBuffer: async () => bytes } as File
    const sheets = await importTabularFile(file)
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Results', 'Other'])
    expect(sheets[0].dataset.importedAnnotations?.referenceLines).toHaveLength(1)
    expect(sheets[1].dataset.importedAnnotations?.referenceLines).toHaveLength(0)
    expect(sheets[0].dataset.importedAnnotations?.referenceRegions).toHaveLength(1)
    expect(sheets[1].dataset.importedAnnotations?.referenceRegions).toHaveLength(1)
    expect(sheets[0].dataset.warnings.filter((warning) => warning.code === 'annotation')).toHaveLength(2)
    expect(sheets[0].dataset.rows).toHaveLength(1)
  })
})
