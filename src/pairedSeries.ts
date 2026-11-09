import { orderedCategories } from './appearance'
import type { DataColumn, DataRow, GraphSpec } from './types'

export interface PairedPoint { x: string; y: number; rowId: string }
export interface PairedTrajectory { subject: string; points: PairedPoint[] }

/** Keep each source measurement intact; ambiguous subject/category pairs are omitted. */
export function pairedSeries(rows: DataRow[], xColumn: DataColumn, yColumn: DataColumn, idColumn: DataColumn, spec: GraphSpec, categoryRows = rows) {
  const warnings: string[] = []
  if (xColumn.modelingType === 'continuous') warnings.push('Paired plots need X categories. Set the X column modeling type to Nominal or Ordinal.')
  if (yColumn.dataType !== 'number') warnings.push('Paired plots need a numeric Y column.')
  if ([xColumn.id, yColumn.id].includes(idColumn.id)) warnings.push('Choose a Subject ID column different from X and Y.')
  if (warnings.length) return { trajectories: [] as PairedTrajectory[], warnings }

  const categories = orderedCategories(categoryRows, xColumn, spec, [], yColumn.id)
  const categoryIndex = new Map(categories.map((category, index) => [category, index]))
  const bySubject = new Map<string, PairedPoint[]>()
  let missingIds = 0
  for (const row of rows) {
    const rawId = row.values[idColumn.id]
    const subject = rawId === null ? '' : String(rawId).trim()
    if (!subject) { missingIds++; continue }
    const rawX = row.values[xColumn.id]
    const rawY = row.values[yColumn.id]
    if (rawX === null || rawY === null) continue
    const y = Number(rawY)
    if (!Number.isFinite(y)) continue
    const x = String(xColumn.valueLabels?.[String(rawX)] ?? rawX)
    const points = bySubject.get(subject) ?? []
    points.push({ x, y, rowId: row.id })
    bySubject.set(subject, points)
  }
  if (missingIds) warnings.push(`${missingIds} row${missingIds === 1 ? '' : 's'} with a missing Subject ID were omitted from the paired plot.`)
  const trajectories: PairedTrajectory[] = []
  let ambiguous = 0
  for (const [subject, points] of bySubject) {
    if (new Set(points.map((point) => point.x)).size !== points.length) { ambiguous++; continue }
    trajectories.push({ subject, points: points.sort((a, b) => (categoryIndex.get(a.x) ?? 0) - (categoryIndex.get(b.x) ?? 0)) })
  }
  if (ambiguous) warnings.push(`${ambiguous} subject${ambiguous === 1 ? '' : 's'} with repeated X categories were omitted. Use one measurement per subject and category.`)
  return { trajectories, warnings }
}
