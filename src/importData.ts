import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { CellValue, DataColumn, DataType, Dataset, DataWarning } from './types'

export interface ImportedSheet {
  name: string
  dataset: Dataset
}

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

const normalizedHeader = (value: unknown, index: number, used: Set<string>) => {
  const base = String(value ?? '').trim() || `Column ${index + 1}`
  let name = base
  let suffix = 2
  while (used.has(name.toLocaleLowerCase())) name = `${base} ${suffix++}`
  used.add(name.toLocaleLowerCase())
  return name
}

const columnId = (name: string, index: number) => {
  const slug = name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${slug || 'column'}_${index}`
}

const looksLikeDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true
  if (typeof value !== 'string' || !/[-/:T]/.test(value)) return false
  return !Number.isNaN(Date.parse(value))
}

export const inferDataType = (values: unknown[]): DataType => {
  const present = values.filter((value) => !isBlank(value))
  if (!present.length) return 'text'
  if (present.every((value) => typeof value === 'boolean' || /^(true|false|yes|no)$/i.test(String(value).trim()))) return 'boolean'
  if (present.every((value) => typeof value === 'number' ? Number.isFinite(value) : Number.isFinite(Number(String(value).replace(/,/g, ''))))) return 'number'
  if (present.every(looksLikeDate)) return 'date'
  return 'text'
}

export const coerceValue = (value: unknown, type: DataType): CellValue => {
  if (isBlank(value)) return null
  if (type === 'number') { const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '')); return Number.isFinite(numeric) ? numeric : null }
  if (type === 'boolean') return typeof value === 'boolean' ? value : /^(true|yes)$/i.test(String(value).trim())
  if (type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
  }
  return String(value)
}

export const datasetFromMatrix = (matrix: unknown[][], name: string): Dataset => {
  const nonempty = matrix.filter((row) => row.some((value) => !isBlank(value)))
  if (!nonempty.length) throw new Error('The selected file or worksheet is empty.')
  const width = Math.max(...nonempty.map((row) => row.length))
  const sourceRows = nonempty.slice(1)
  const keptColumnIndexes = Array.from({ length: width }, (_, index) => index).filter((index) =>
    !isBlank(nonempty[0][index]) || sourceRows.some((row) => !isBlank(row[index])),
  )
  const usedNames = new Set<string>()
  const warnings: DataWarning[] = []
  const rawHeaders = keptColumnIndexes.map((index) => nonempty[0][index])
  const seenHeaders = new Set<string>()
  rawHeaders.forEach((value, index) => {
    const sourceIndex = keptColumnIndexes[index]
    const heading = String(value ?? '').trim()
    if (!heading) warnings.push({ code: 'empty-heading', message: `Column ${sourceIndex + 1} had an empty heading and was renamed.` })
    else if (seenHeaders.has(heading.toLocaleLowerCase())) warnings.push({ code: 'duplicate-heading', message: `Duplicate heading “${heading}” was renamed.` })
    seenHeaders.add(heading.toLocaleLowerCase())
  })
  const headers = rawHeaders.map((value, index) => normalizedHeader(value, keptColumnIndexes[index], usedNames))
  const types = headers.map((_, columnIndex) => inferDataType(sourceRows.map((row) => row[keptColumnIndexes[columnIndex]])))
  const columns: DataColumn[] = headers.map((columnName, index) => ({
    id: columnId(columnName, keptColumnIndexes[index]),
    name: columnName,
    dataType: types[index],
    modelingType: types[index] === 'number' || types[index] === 'date' ? 'continuous' : 'nominal',
  }))
  columns.forEach((column, columnIndex) => {
    const sourceColumnIndex = keptColumnIndexes[columnIndex]
    const present = sourceRows.map((row) => row[sourceColumnIndex]).filter((value) => !isBlank(value))
    const kinds = new Set(present.map((value) => inferDataType([value])))
    if (kinds.size > 1) warnings.push({ code: 'mixed-types', columnId: column.id, message: `${column.name} contains mixed value types and was imported as ${column.dataType}.` })
    const dateLike = present.filter(looksLikeDate).length
    if (dateLike > 0 && dateLike < present.length) warnings.push({ code: 'invalid-date', columnId: column.id, message: `${column.name} contains values mixed with invalid dates.` })
  })

  return {
    name,
    columns,
    warnings,
    rows: sourceRows.map((sourceRow, rowIndex) => ({
      id: `row-${rowIndex + 1}`,
      excluded: false,
      values: Object.fromEntries(columns.map((column, columnIndex) => [column.id, coerceValue(sourceRow[keptColumnIndexes[columnIndex]], column.dataType)])),
    })),
  }
}

export const importTabularFile = async (file: File): Promise<ImportedSheet[]> => {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase()
  const baseName = file.name.replace(/\.[^.]+$/, '')
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, {
      delimiter: extension === 'tsv' ? '\t' : '',
      skipEmptyLines: 'greedy',
    })
    if (parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0].message)
    return [{ name: baseName, dataset: datasetFromMatrix(parsed.data, baseName) }]
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
    return workbook.SheetNames.map((sheetName) => ({
      name: sheetName,
      dataset: datasetFromMatrix(XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null }), `${baseName} · ${sheetName}`),
    }))
  }

  throw new Error('Choose a CSV, TSV, XLSX, or XLS file.')
}
