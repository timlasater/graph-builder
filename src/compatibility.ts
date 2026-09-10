import type { DataColumn, DataRow, GraphElement, GraphRole, GraphSpec } from './types'

export const multiRoles: GraphRole[] = ['x', 'y']
export const numericRoles: GraphRole[] = ['size', 'weight']

export interface AssignmentResult { spec: GraphSpec; accepted: boolean; message?: string }

const removeFromRole = (spec: GraphSpec, role: GraphRole, columnId: string) => {
  if (role === 'x' || role === 'y') spec[role] = spec[role].filter((id) => id !== columnId)
  else {
    const record = spec as unknown as Record<string, unknown>
    if (record[role] === columnId) delete record[role]
  }
  if (role === 'page') delete spec.pageValue
}

export const resolveAssignment = (source: GraphSpec, column: DataColumn, toRole?: GraphRole, fromRole?: GraphRole, targetIndex?: number): AssignmentResult => {
  const spec = structuredClone(source)
  if (toRole && numericRoles.includes(toRole) && column.dataType !== 'number') {
    return { spec: source, accepted: false, message: `${column.name} must be numeric for ${toRole === 'weight' ? 'Frequency/Weight' : 'Size'}.` }
  }
  if (fromRole) removeFromRole(spec, fromRole, column.id)
  if (!toRole) return { spec, accepted: true }

  if (toRole === 'wrap') { delete spec.groupX; delete spec.groupY }
  else if (toRole === 'groupX' || toRole === 'groupY') delete spec.wrap

  if (toRole === 'x' || toRole === 'y') {
    const values = spec[toRole].filter((id) => id !== column.id)
    values.splice(targetIndex === undefined ? values.length : Math.max(0, Math.min(targetIndex, values.length)), 0, column.id)
    spec[toRole] = values
  } else (spec as unknown as Record<string, unknown>)[toRole] = column.id
  return { spec, accepted: true }
}

export const sameAssignments = (left: GraphSpec, right: GraphSpec) =>
  JSON.stringify({ x: left.x, y: left.y, color: left.color, groupX: left.groupX, groupY: left.groupY, wrap: left.wrap, overlay: left.overlay, size: left.size, shape: left.shape, weight: left.weight, page: left.page }) ===
  JSON.stringify({ x: right.x, y: right.y, color: right.color, groupX: right.groupX, groupY: right.groupY, wrap: right.wrap, overlay: right.overlay, size: right.size, shape: right.shape, weight: right.weight, page: right.page })

export interface ElementSuggestion { element: GraphElement; reason: string }

export const elementLabel = (element: GraphElement) => element === 'summary' ? 'Mean line' : element === 'bar' ? 'Bars' : element === 'box' ? 'Box plot' : element[0].toUpperCase() + element.slice(1)

export const suggestElement = (x: DataColumn[], y: DataColumn[], rows: DataRow[] = []): ElementSuggestion => {
  if (!x.length || !y.length) return { element: 'points', reason: 'Assign both X and Y before choosing a specialized chart.' }
  if (!y.every((column) => column.dataType === 'number')) return { element: 'points', reason: 'Points preserve non-numeric Y values without implying an aggregate or trend.' }

  const hasRepeatedX = rows.length > 0 && x.some((column) => {
    const values = rows.map((row) => row.values[column.id]).filter((value) => value !== null).map(String)
    return new Set(values).size < values.length
  })
  if (hasRepeatedX) return { element: 'summary', reason: 'Repeated X values were detected, so a mean line summarizes the replicates.' }
  if (x.some((column) => column.modelingType === 'nominal')) return { element: 'bar', reason: 'Bars make comparisons between unordered X categories easy to read.' }
  if (x.some((column) => column.dataType === 'date' || column.modelingType === 'ordinal')) return { element: 'line', reason: 'A line emphasizes progression along an ordered or date-based X axis.' }
  if (x.every((column) => column.dataType === 'number' && column.modelingType === 'continuous')) return { element: 'fit', reason: 'A fitted line summarizes the relationship between continuous numeric axes.' }
  return { element: 'points', reason: 'Points are the safest general-purpose representation for these axis types.' }
}

export const suggestedElement = (x: DataColumn[], y: DataColumn[], rows: DataRow[] = []) => suggestElement(x, y, rows).element
