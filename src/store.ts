import { create } from 'zustand'
import { sampleDataset } from './sampleData'
import { coerceValue } from './importData'
import { calculateColumn, recalculateFormulaColumns } from './formula'
import { elementLabel, resolveAssignment, sameAssignments, suggestElement } from './compatibility'
import type { CellValue, DataColumn, Dataset, GraphElement, GraphLayer, GraphRole, GraphSpec, RowFilter } from './types'

const initialSpec: GraphSpec = {
  title: 'Emitted Dose by Test Pressure',
  subtitle: 'Built-in example data · drag variables to change the graph',
  x: ['pressure'],
  y: ['dose'],
  color: 'prototype',
  layers: [{ id: 'layer-points', name: 'Points', element: 'points' }],
  activeLayerId: 'layer-points',
  showGrid: true,
  markerSize: 9,
}

export const defaultGraphSpec = (dataset: Dataset): GraphSpec => {
  const numeric = dataset.columns.filter((column) => column.dataType === 'number')
  const category = dataset.columns.find((column) => column.modelingType !== 'continuous')
  return {
    title: dataset.name,
    subtitle: `${dataset.rows.length} rows · drag variables to change the graph`,
    x: numeric[0] ? [numeric[0].id] : [],
    y: numeric[1] ? [numeric[1].id] : [],
    color: category?.id,
    layers: [{ id: 'layer-points', name: 'Points', element: 'points' }],
    activeLayerId: 'layer-points',
    showGrid: true,
    markerSize: 9,
  }
}

interface BuilderState {
  dataset: Dataset
  spec: GraphSpec
  past: HistoryEntry[]
  future: HistoryEntry[]
  filters: RowFilter[]
  selectedColumn?: string
  assign: (role: GraphRole, columnId?: string) => void
  moveAssignment: (columnId: string, toRole?: GraphRole, fromRole?: GraphRole, targetIndex?: number) => void
  updateSpec: (patch: Partial<GraphSpec>) => void
  setElement: (element: GraphElement) => void
  addLayer: (element: GraphElement) => void
  removeLayer: (layerId: string) => void
  updateLayer: (layerId: string, patch: Partial<Omit<GraphLayer, 'id'>>) => void
  setActiveLayer: (layerId: string) => void
  swapAxes: () => void
  applySuggestion: () => void
  setPageValue: (value?: CellValue) => void
  compatibilityMessage?: string
  clearCompatibilityMessage: () => void
  setSelectedColumn: (columnId?: string) => void
  setDataset: (dataset: Dataset) => void
  updateColumn: (columnId: string, patch: Partial<Pick<DataColumn, 'name' | 'dataType' | 'modelingType' | 'unit'>>) => void
  updateCell: (rowId: string, columnId: string, value: CellValue) => void
  setRowExcluded: (rowId: string, excluded: boolean) => void
  setRowsExcluded: (rowIds: string[], excluded: boolean) => void
  setFilters: (filters: RowFilter[]) => void
  addCalculatedColumn: (name: string, formula: string) => void
  setValueLabels: (columnId: string, labels: Record<string, string>) => void
  appendRows: (matrix: unknown[][]) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

interface HistoryEntry { dataset: Dataset; spec: GraphSpec; filters: RowFilter[] }
const snapshot = (state: Pick<BuilderState, 'dataset' | 'spec' | 'filters'>): HistoryEntry => structuredClone({ dataset: state.dataset, spec: state.spec, filters: state.filters })
const withHistory = (state: BuilderState, patch: Partial<BuilderState>) => ({ ...patch, past: [...state.past, snapshot(state)], future: [] })
const withRecalculatedFormulas = (dataset: Dataset, rows: Dataset['rows']): Dataset => {
  const result = recalculateFormulaColumns(dataset.columns, rows)
  return { ...dataset, rows: result.rows, warnings: [...dataset.warnings.filter((warning) => warning.code !== 'formula'), ...result.warnings] }
}

export const rowMatchesFilters = (row: Dataset['rows'][number], filters: RowFilter[]) => filters.every((filter) => {
  const actual = row.values[filter.columnId]; const expected = filter.value
  if (filter.operator === 'isMissing') return actual === null
  if (filter.operator === 'isNotMissing') return actual !== null
  if (filter.operator === 'in') return (filter.values ?? []).some((value) => value === actual)
  if (filter.operator === 'between') {
    const numeric = Number(actual)
    return Number.isFinite(numeric) && (filter.min === undefined || numeric >= filter.min) && (filter.max === undefined || numeric <= filter.max)
  }
  if (filter.operator === 'contains') return String(actual ?? '').toLocaleLowerCase().includes(String(expected ?? '').toLocaleLowerCase())
  if (filter.operator === 'equals') return String(actual ?? '') === String(expected ?? '')
  if (filter.operator === 'notEquals') return String(actual ?? '') !== String(expected ?? '')
  const left = Number(actual); const right = Number(expected)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  return filter.operator === 'gt' ? left > right : filter.operator === 'gte' ? left >= right : filter.operator === 'lt' ? left < right : left <= right
})

export const moveRoleAssignment = (spec: GraphSpec, columnId: string, toRole?: GraphRole, fromRole?: GraphRole, targetIndex?: number, columns: DataColumn[] = sampleDataset.columns, rows = sampleDataset.rows): GraphSpec => {
  const column = columns.find((item) => item.id === columnId)
  return column ? resolveAssignment(spec, column, toRole, fromRole, targetIndex, rows).spec : spec
}
const layerName = elementLabel

export const useBuilderStore = create<BuilderState>((set) => ({
  dataset: sampleDataset,
  spec: initialSpec,
  past: [],
  future: [],
  filters: [],
  compatibilityMessage: undefined,
  assign: (role, columnId) =>
    set((state) => {
      if (!columnId) {
        const spec = structuredClone(state.spec)
        if (role === 'x' || role === 'y') spec[role] = []; else delete spec[role]
        return withHistory(state, { spec })
      }
      const column = state.dataset.columns.find((item) => item.id === columnId)
      if (!column) return state
      const result = resolveAssignment(state.spec, column, role, undefined, undefined, state.dataset.rows)
      if (result.accepted && role === 'page') result.spec.pageValue = state.dataset.rows[0]?.values[column.id]
      return result.accepted ? withHistory(state, { spec: result.spec, compatibilityMessage: undefined }) : { compatibilityMessage: result.message }
    }),
  moveAssignment: (columnId, toRole, fromRole, targetIndex) =>
    set((state) => {
      const column = state.dataset.columns.find((item) => item.id === columnId)
      if (!column) return state
      const result = resolveAssignment(state.spec, column, toRole, fromRole, targetIndex, state.dataset.rows)
      if (result.accepted && toRole === 'page' && result.spec.pageValue === undefined) result.spec.pageValue = state.dataset.rows[0]?.values[column.id]
      if (!result.accepted) return { compatibilityMessage: result.message }
      if (sameAssignments(state.spec, result.spec)) return state
      return withHistory(state, { spec: result.spec, compatibilityMessage: undefined })
    }),
  updateSpec: (patch) =>
    set((state) => withHistory(state, { spec: { ...state.spec, ...patch } })),
  setElement: (element) =>
    set((state) => {
      const layerId = state.spec.activeLayerId
      const layers = state.spec.layers.map((layer) => layer.id === layerId ? { ...layer, element, name: layerName(element) } : layer)
      return withHistory(state, { spec: { ...state.spec, layers } })
    }),
  addLayer: (element) => set((state) => {
    const id = `layer-${crypto.randomUUID()}`
    const layer: GraphLayer = { id, name: layerName(element), element, ...(element === 'summary' ? { errorBar: 'sd' as const } : {}) }
    return withHistory(state, { spec: { ...state.spec, layers: [...state.spec.layers, layer], activeLayerId: id } })
  }),
  removeLayer: (layerId) => set((state) => {
    if (state.spec.layers.length <= 1) return { compatibilityMessage: 'A graph needs at least one layer.' }
    const layers = state.spec.layers.filter((layer) => layer.id !== layerId)
    return withHistory(state, { spec: { ...state.spec, layers, activeLayerId: state.spec.activeLayerId === layerId ? layers[0].id : state.spec.activeLayerId } })
  }),
  updateLayer: (layerId, patch) => set((state) => withHistory(state, { spec: { ...state.spec, layers: state.spec.layers.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer) } })),
  setActiveLayer: (activeLayerId) => set((state) => ({ spec: { ...state.spec, activeLayerId } })),
  swapAxes: () => set((state) => withHistory(state, { spec: { ...state.spec, x: state.spec.y, y: state.spec.x } })),
  applySuggestion: () => set((state) => {
    const activeLayer = state.spec.layers.find((layer) => layer.id === state.spec.activeLayerId) ?? state.spec.layers[0]
    const xIds = activeLayer?.x ? [activeLayer.x] : state.spec.x; const yIds = activeLayer?.y ? [activeLayer.y] : state.spec.y
    const x = xIds.map((id) => state.dataset.columns.find((column) => column.id === id)).filter((column): column is DataColumn => Boolean(column))
    const y = yIds.map((id) => state.dataset.columns.find((column) => column.id === id)).filter((column): column is DataColumn => Boolean(column))
    const rows = state.dataset.rows.filter((row) => !row.excluded && rowMatchesFilters(row, state.filters) && (!state.spec.page || state.spec.pageValue === undefined || row.values[state.spec.page] === state.spec.pageValue))
    const suggestion = suggestElement(x, y, rows); const message = `${elementLabel(suggestion.element)} suggested: ${suggestion.reason}`
    if (!activeLayer || activeLayer.element === suggestion.element) return { compatibilityMessage: `Already using ${message.toLocaleLowerCase()}` }
    return withHistory(state, { compatibilityMessage: message, spec: { ...state.spec, layers: state.spec.layers.map((layer) => layer.id === state.spec.activeLayerId ? { ...layer, element: suggestion.element, name: layerName(suggestion.element) } : layer) } })
  }),
  setPageValue: (pageValue) => set((state) => withHistory(state, { spec: { ...state.spec, pageValue } })),
  clearCompatibilityMessage: () => set({ compatibilityMessage: undefined }),
  setSelectedColumn: (selectedColumn) => set({ selectedColumn }),
  setDataset: (dataset) => set({ dataset, spec: defaultGraphSpec(dataset), filters: [], past: [], future: [], selectedColumn: undefined }),
  updateColumn: (columnId, patch) => set((state) => {
    const previousColumn = state.dataset.columns.find((column) => column.id === columnId)
    if (!previousColumn) return state
    const nextType = patch.dataType ?? previousColumn.dataType
    const typeChanged = nextType !== previousColumn.dataType
    const convertedRows = typeChanged ? state.dataset.rows.map((row) => ({ ...row, values: { ...row.values, [columnId]: coerceValue(row.values[columnId], nextType) } })) : state.dataset.rows
    const lossCount = typeChanged ? convertedRows.filter((row, index) => state.dataset.rows[index].values[columnId] !== null && row.values[columnId] === null).length : 0
    const dataset = {
      ...state.dataset,
      columns: state.dataset.columns.map((column) => column.id === columnId ? { ...column, ...patch } : column),
      rows: convertedRows,
      warnings: lossCount ? [...state.dataset.warnings, { code: nextType === 'date' ? 'invalid-date' as const : 'lossy-coercion' as const, columnId, message: `${previousColumn.name}: ${lossCount} value(s) could not be converted to ${nextType} and became missing.` }] : state.dataset.warnings,
    }
    return withHistory(state, { dataset: withRecalculatedFormulas(dataset, convertedRows) })
  }),
  updateCell: (rowId, columnId, value) => set((state) => {
    const column = state.dataset.columns.find((candidate) => candidate.id === columnId)
    if (!column) return state
    const rows = state.dataset.rows.map((row) => row.id === rowId ? {
      ...row, values: { ...row.values, [columnId]: coerceValue(value, column.dataType) },
    } : row)
    return withHistory(state, { dataset: withRecalculatedFormulas(state.dataset, rows) })
  }),
  setRowExcluded: (rowId, excluded) => set((state) => withHistory(state, {
    dataset: { ...state.dataset, rows: state.dataset.rows.map((row) => row.id === rowId ? { ...row, excluded } : row) },
  })),
  setRowsExcluded: (rowIds, excluded) => set((state) => {
    const ids = new Set(rowIds)
    return withHistory(state, { dataset: { ...state.dataset, rows: state.dataset.rows.map((row) => ids.has(row.id) ? { ...row, excluded } : row) } })
  }),
  setFilters: (filters) => set((state) => withHistory(state, { filters })),
  addCalculatedColumn: (name, formula) => set((state) => {
    const result = calculateColumn(name, formula, state.dataset.columns, state.dataset.rows)
    return withHistory(state, { dataset: { ...state.dataset, columns: [...state.dataset.columns, result.column], rows: state.dataset.rows.map((row, index) => ({ ...row, values: { ...row.values, [result.column.id]: result.values[index] } })), warnings: [...state.dataset.warnings, ...result.warnings] } })
  }),
  setValueLabels: (columnId, labels) => set((state) => withHistory(state, { dataset: { ...state.dataset, columns: state.dataset.columns.map((column) => column.id === columnId ? { ...column, valueLabels: labels } : column) } })),
  appendRows: (matrix) => set((state) => {
    const inputColumns = state.dataset.columns.filter((column) => !column.formula)
    if (!matrix.length || matrix.some((row) => row.length !== inputColumns.length)) throw new Error(`Paste ${inputColumns.length} non-calculated columns per row.`)
    const start = state.dataset.rows.length
    const rows = matrix.map((values, index) => ({ id: `row-${start + index + 1}`, excluded: false, values: Object.fromEntries(inputColumns.map((column, columnIndex) => [column.id, coerceValue(values[columnIndex], column.dataType)])) }))
    return withHistory(state, { dataset: withRecalculatedFormulas(state.dataset, [...state.dataset.rows, ...rows]) })
  }),
  undo: () => set((state) => {
    const previous = state.past.at(-1)
    if (!previous) return state
    return { ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] }
  }),
  redo: () => set((state) => {
    const next = state.future[0]
    if (!next) return state
    return { ...next, past: [...state.past, snapshot(state)], future: state.future.slice(1) }
  }),
  reset: () => set({
    dataset: sampleDataset,
    spec: initialSpec,
    past: [],
    future: [],
    filters: [],
    selectedColumn: undefined,
    compatibilityMessage: undefined,
  }),
}))
