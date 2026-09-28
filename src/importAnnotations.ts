import type { DataWarning, ImportedAnnotations, ReferenceLine, ReferenceRegion } from './types'

type AnnotationEntry = { targetSheet?: string; line?: ReferenceLine; region?: ReferenceRegion }
export interface ParsedAnnotations { entries: AnnotationEntry[]; warnings: DataWarning[]; dataMatrix: unknown[][] }

const blank = (value: unknown) => value === null || value === undefined || String(value).trim() === ''
const key = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()
const number = (value: unknown) => blank(value) ? undefined : Number(String(value).replace(/,/g, ''))

export const parseAnnotationMatrix = (matrix: unknown[][], source: string, separateSheet = false): ParsedAnnotations => {
  const nonempty = matrix.filter((row) => row.some((value) => !blank(value)))
  if (!nonempty.length) return { entries: [], warnings: [], dataMatrix: matrix }
  const headings = nonempty[0].map(key)
  const prefix = separateSheet ? '' : 'gb '
  const field = (name: string) => headings.indexOf(`${prefix}${name}`)
  const typeIndex = field('type')
  if (typeIndex < 0) {
    if (separateSheet) throw new Error('The Graph Annotations worksheet needs Type and Axis headings.')
    return { entries: [], warnings: [], dataMatrix: matrix }
  }
  const axisIndex = field('axis')
  if (axisIndex < 0) throw new Error(`${source}: an annotation Type column requires an Axis column.`)
  const reserved = new Set(['type', 'axis', 'value', 'minimum', 'maximum', 'label', 'color', 'target sheet'].map((name) => `${prefix}${name}`))
  const keep = headings.map((heading, index) => reserved.has(heading) ? -1 : index).filter((index) => index >= 0)
  const entries: AnnotationEntry[] = []
  const warnings: DataWarning[] = []
  const dataRows: unknown[][] = []
  nonempty.slice(1).forEach((row, index) => {
    const kind = key(row[typeIndex])
    if (!separateSheet && (!kind || kind === 'data')) { dataRows.push(keep.map((column) => row[column])); return }
    const rowNumber = index + 2
    const warning = (message: string) => warnings.push({ code: 'annotation', message: `${source}, row ${rowNumber}: ${message}` })
    if (kind !== 'reference-line' && kind !== 'acceptance-region') { warning(`Unknown annotation type “${String(row[typeIndex] ?? '')}”; use reference-line or acceptance-region.`); return }
    const axis = key(row[axisIndex])
    if (axis !== 'x' && axis !== 'y') { warning('Axis must be X or Y.'); return }
    const colorIndex = field('color')
    const suppliedColor = colorIndex < 0 || blank(row[colorIndex]) ? undefined : String(row[colorIndex]).trim()
    if (suppliedColor && !/^#[0-9a-f]{6}$/i.test(suppliedColor)) { warning('Color must be a six-digit hex value such as #c2413b.'); return }
    const targetIndex = field('target sheet')
    const targetSheet = targetIndex < 0 || blank(row[targetIndex]) ? undefined : String(row[targetIndex]).trim()
    const labelIndex = field('label')
    const label = labelIndex < 0 || blank(row[labelIndex]) ? undefined : String(row[labelIndex]).trim()
    const id = `import-${source}-${rowNumber}`
    if (kind === 'reference-line') {
      const valueIndex = field('value')
      const value = valueIndex < 0 ? undefined : number(row[valueIndex])
      if (value === undefined || !Number.isFinite(value)) { warning('Reference line needs a numeric Value.'); return }
      entries.push({ targetSheet, line: { id, axis, value, label, color: suppliedColor ?? '#c2413b' } })
      return
    }
    const minIndex = field('minimum'); const maxIndex = field('maximum')
    const min = minIndex < 0 ? undefined : number(row[minIndex]); const max = maxIndex < 0 ? undefined : number(row[maxIndex])
    if (min === undefined || max === undefined || !Number.isFinite(min) || !Number.isFinite(max) || min >= max) { warning('Acceptance region needs numeric Minimum and Maximum, with Minimum below Maximum.'); return }
    entries.push({ targetSheet, region: { id, axis, min, max, label, color: suppliedColor ?? '#d9a441' } })
  })
  return { entries, warnings, dataMatrix: separateSheet ? matrix : [keep.map((column) => nonempty[0][column]), ...dataRows] }
}

export const annotationsForSheet = (entries: AnnotationEntry[], sheetName: string): ImportedAnnotations => ({
  referenceLines: entries.filter((entry) => !entry.targetSheet || key(entry.targetSheet) === key(sheetName)).flatMap((entry) => entry.line ? [entry.line] : []),
  referenceRegions: entries.filter((entry) => !entry.targetSheet || key(entry.targetSheet) === key(sheetName)).flatMap((entry) => entry.region ? [entry.region] : []),
})

export const unmatchedAnnotationTargets = (entries: AnnotationEntry[], sheetNames: string[]) => [...new Set(entries.map((entry) => entry.targetSheet).filter((target): target is string => Boolean(target) && !sheetNames.some((name) => key(name) === key(target))))]
