import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { annotationsForSheet, parseAnnotationMatrix, unmatchedAnnotationTargets } from './importAnnotations'
import type { CellValue, DataColumn, DataType, Dataset, DataWarning } from './types'

export interface ImportedSheet {
  name: string
  dataset: Dataset
}

export interface PreparedTabularFile {
  fileName: string
  kind: 'text' | 'workbook'
  sheets: { name: string; matrix: unknown[][] }[]
  annotationSheet?: { name: string; matrix: unknown[][] }
}

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
const missingMarkers = new Set(['n/a', 'na', '#n/a', '<na>', 'null', 'none', 'nil', 'nan', 'missing'])
const isMissingValue = (value: unknown) => isBlank(value) || (typeof value === 'string' && missingMarkers.has(value.trim().toLocaleLowerCase()))

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
  const present = values.filter((value) => !isMissingValue(value))
  if (!present.length) return 'text'
  if (present.every((value) => typeof value === 'boolean' || /^(true|false|yes|no)$/i.test(String(value).trim()))) return 'boolean'
  if (present.every((value) => typeof value === 'number' ? Number.isFinite(value) : Number.isFinite(Number(String(value).replace(/,/g, ''))))) return 'number'
  if (present.every(looksLikeDate)) return 'date'
  return 'text'
}

export const coerceValue = (value: unknown, type: DataType): CellValue => {
  if (isMissingValue(value)) return null
  if (type === 'number') { const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '')); return Number.isFinite(numeric) ? numeric : null }
  if (type === 'boolean') return typeof value === 'boolean' ? value : /^(true|yes)$/i.test(String(value).trim())
  if (type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
  }
  return String(value)
}

export const datasetFromMatrix = (matrix: unknown[][], name: string, skipRows = 0): Dataset => {
  if (!Number.isSafeInteger(skipRows) || skipRows < 0) throw new Error('The number of rows to skip must be a whole number of zero or more.')
  const annotationResult = parseAnnotationMatrix(matrix.slice(skipRows), name)
  const nonempty = annotationResult.dataMatrix.filter((row) => row.some((value) => !isMissingValue(value)))
  if (!nonempty.length) throw new Error('No header row remains after skipping rows. Choose a smaller number.')
  const width = Math.max(...nonempty.map((row) => row.length))
  const sourceRows = nonempty.slice(1)
  const keptColumnIndexes = Array.from({ length: width }, (_, index) => index).filter((index) =>
    !isBlank(nonempty[0][index]) || sourceRows.some((row) => !isMissingValue(row[index])),
  )
  const usedNames = new Set<string>()
  const warnings: DataWarning[] = [...annotationResult.warnings]
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
    const present = sourceRows.map((row) => row[sourceColumnIndex]).filter((value) => !isMissingValue(value))
    const kinds = new Set(present.map((value) => inferDataType([value])))
    if (kinds.size > 1) warnings.push({ code: 'mixed-types', columnId: column.id, message: `${column.name} contains mixed value types and was imported as ${column.dataType}.` })
    const dateLike = present.filter(looksLikeDate).length
    if (dateLike > 0 && dateLike < present.length) warnings.push({ code: 'invalid-date', columnId: column.id, message: `${column.name} contains values mixed with invalid dates.` })
  })

  return {
    name,
    columns,
    warnings,
    importedAnnotations: annotationsForSheet(annotationResult.entries, name),
    rows: sourceRows.map((sourceRow, rowIndex) => ({
      id: `row-${rowIndex + 1}`,
      excluded: false,
      values: Object.fromEntries(columns.map((column, columnIndex) => [column.id, coerceValue(sourceRow[keptColumnIndexes[columnIndex]], column.dataType)])),
    })),
  }
}

export const prepareTabularFile = async (file: File): Promise<PreparedTabularFile> => {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase()
  const baseName = file.name.replace(/\.[^.]+$/, '')
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, { delimiter: extension === 'tsv' ? '\t' : '', skipEmptyLines: false })
    if (extension === 'csv' && parsed.errors.length && parsed.errors.every((error) => error.code === 'UndetectableDelimiter')) {
      const commaParsed = Papa.parse<string[]>(text, { delimiter: ',', skipEmptyLines: false })
      if (!commaParsed.errors.length) return { fileName: file.name, kind: 'text', sheets: [{ name: baseName, matrix: commaParsed.data }] }
    }
    if (parsed.errors.length) throw new Error(`The file has a CSV formatting error near row ${parsed.errors[0].row ?? 1}: ${parsed.errors[0].message}. Check its quotes and separators, then try again.`)
    return { fileName: file.name, kind: 'text', sheets: [{ name: baseName, matrix: parsed.data }] }
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
    const matrixFor = (sheetName: string) => XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null })
    const annotationSheet = workbook.SheetNames.find((sheetName) => sheetName.trim().toLocaleLowerCase() === 'graph annotations')
    const dataSheetNames = workbook.SheetNames.filter((sheetName) => sheetName !== annotationSheet)
    if (!dataSheetNames.length) throw new Error('The workbook needs at least one data worksheet besides Graph Annotations.')
    return { fileName: file.name, kind: 'workbook', sheets: dataSheetNames.map((name) => ({ name, matrix: matrixFor(name) })), annotationSheet: annotationSheet ? { name: annotationSheet, matrix: matrixFor(annotationSheet) } : undefined }
  }

  throw new Error('Choose a CSV, TSV, XLSX, or XLS file.')
}

export const importPreparedFile = (prepared: PreparedTabularFile, skipRows = 0, selectedSheet?: string): ImportedSheet[] => {
  const baseName = prepared.fileName.replace(/\.[^.]+$/, '')
  const separate = prepared.annotationSheet ? parseAnnotationMatrix(prepared.annotationSheet.matrix, prepared.annotationSheet.name, true) : undefined
  const unmatched = separate ? unmatchedAnnotationTargets(separate.entries, prepared.sheets.map((sheet) => sheet.name)) : []
  return prepared.sheets.filter((sheet) => !selectedSheet || sheet.name === selectedSheet).map(({ name, matrix }) => {
    const dataset = datasetFromMatrix(matrix, prepared.kind === 'text' ? baseName : `${baseName} · ${name}`, skipRows)
    if (prepared.kind === 'text') return { name, dataset }
    const extra = separate ? annotationsForSheet(separate.entries, name) : undefined
    dataset.importedAnnotations = {
      referenceLines: [...(dataset.importedAnnotations?.referenceLines ?? []), ...(extra?.referenceLines ?? [])],
      referenceRegions: [...(dataset.importedAnnotations?.referenceRegions ?? []), ...(extra?.referenceRegions ?? [])],
    }
    dataset.warnings.push(...(separate?.warnings ?? []))
    dataset.warnings.push(...unmatched.map((target) => ({ code: 'annotation' as const, message: `Graph Annotations: Target Sheet “${target}” was not found in this workbook.` })))
    return { name, dataset }
  })
}

export const importTabularFile = async (file: File, skipRows = 0): Promise<ImportedSheet[]> => importPreparedFile(await prepareTabularFile(file), skipRows)
