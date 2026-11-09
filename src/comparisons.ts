import { studentTCdf, studentTCritical } from './statistics'
import type { DataColumn, DataRow, GraphComparison } from './types'

export interface ComparisonResult {
  method: GraphComparison['method']
  nA: number
  nB: number
  difference: number
  lower: number
  upper: number
  t: number
  degreesOfFreedom: number
  pValue: number
  notes: string[]
}

const moments = (values: number[]) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return { mean, variance }
}

/** Difference is category B minus category A. Both tests are two-sided. */
export function compareCategories(rows: DataRow[], xColumn: DataColumn, yColumn: DataColumn, comparison: GraphComparison, idColumn?: DataColumn): { result?: ComparisonResult; error?: string } {
  if (xColumn.modelingType === 'continuous' || yColumn.dataType !== 'number') return { error: 'Choose a categorical X column and a numeric Y column.' }
  if (!comparison.categoryA || !comparison.categoryB || comparison.categoryA === comparison.categoryB) return { error: 'Choose two different X categories.' }
  if (!(comparison.confidenceLevel > 0 && comparison.confidenceLevel < 1)) return { error: 'Choose a confidence level between 0 and 100%.' }
  if (comparison.method === 'paired' && (!idColumn || [xColumn.id, yColumn.id].includes(idColumn.id))) return { error: 'Choose a Subject ID column different from X and Y.' }

  const values = rows.flatMap((row) => {
    const category = xColumn.valueLabels?.[String(row.values[xColumn.id])] ?? String(row.values[xColumn.id] ?? '')
    const rawY = row.values[yColumn.id]
    const y = rawY === null ? Number.NaN : Number(rawY)
    return (category === comparison.categoryA || category === comparison.categoryB) && Number.isFinite(y) ? [{ category, y, id: idColumn ? row.values[idColumn.id] : null }] : []
  })
  let a: number[]; let b: number[]; const notes: string[] = []
  if (comparison.method === 'paired') {
    const bySubject = new Map<string, { a: number[]; b: number[] }>()
    for (const value of values) {
      const subject = value.id === null ? '' : String(value.id).trim()
      if (!subject) continue
      const pair = bySubject.get(subject) ?? { a: [], b: [] }
      pair[value.category === comparison.categoryA ? 'a' : 'b'].push(value.y)
      bySubject.set(subject, pair)
    }
    const complete = [...bySubject.values()].filter((pair) => pair.a.length === 1 && pair.b.length === 1)
    const ambiguous = [...bySubject.values()].filter((pair) => pair.a.length > 1 || pair.b.length > 1).length
    if (ambiguous) notes.push(`${ambiguous} subject${ambiguous === 1 ? '' : 's'} with repeated category measurements were omitted.`)
    a = complete.map((pair) => pair.a[0]); b = complete.map((pair) => pair.b[0])
    if (a.length < 2) return { error: 'A paired comparison needs at least two subjects with one valid measurement in each category.' }
  } else {
    a = values.filter((value) => value.category === comparison.categoryA).map((value) => value.y)
    b = values.filter((value) => value.category === comparison.categoryB).map((value) => value.y)
    if (a.length < 2 || b.length < 2) return { error: 'An independent comparison needs at least two measurements in each category.' }
  }

  let difference: number; let standardError: number; let degreesOfFreedom: number
  if (comparison.method === 'paired') {
    const differences = b.map((value, index) => value - a[index])
    const stats = moments(differences)
    difference = stats.mean
    standardError = Math.sqrt(stats.variance / differences.length)
    degreesOfFreedom = differences.length - 1
  } else {
    const first = moments(a); const second = moments(b)
    difference = second.mean - first.mean
    const va = first.variance / a.length; const vb = second.variance / b.length
    standardError = Math.sqrt(va + vb)
    degreesOfFreedom = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1))
  }
  if (!Number.isFinite(standardError) || standardError <= 0 || !Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) return { error: 'The comparison needs variation in its measurements to estimate uncertainty.' }
  const critical = studentTCritical(comparison.confidenceLevel, degreesOfFreedom)
  if (critical === null) return { error: 'The confidence interval could not be calculated.' }
  const t = difference / standardError
  const pValue = Math.max(0, Math.min(1, 2 * (1 - studentTCdf(Math.abs(t), degreesOfFreedom))))
  return { result: { method: comparison.method, nA: a.length, nB: b.length, difference, lower: difference - critical * standardError, upper: difference + critical * standardError, t, degreesOfFreedom, pValue, notes } }
}
