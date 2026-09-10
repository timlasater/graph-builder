import { create } from 'zustand'
import { sampleDataset } from './sampleData'
import { coerceValue } from './importData'
import type { CellValue, DataColumn, Dataset, GraphElement, GraphRole, GraphSpec } from './types'

const initialSpec: GraphSpec = {
  title: 'Emitted Dose by Test Pressure',
  subtitle: 'Built-in example data · drag variables to change the graph',
  x: 'pressure',
  y: 'dose',
  color: 'prototype',
  element: 'points',
  showGrid: true,
  markerSize: 9,
}

export const defaultGraphSpec = (dataset: Dataset): GraphSpec => {
  const numeric = dataset.columns.filter((column) => column.dataType === 'number')
  const category = dataset.columns.find((column) => column.modelingType !== 'continuous')
  return {
    title: dataset.name,
    subtitle: `${dataset.rows.length} rows · drag variables to change the graph`,
    x: numeric[0]?.id,
    y: numeric[1]?.id,
    color: category?.id,
    element: 'points',
    showGrid: true,
    markerSize: 9,
  }
}

interface BuilderState {
  dataset: Dataset
  spec: GraphSpec
  past: GraphSpec[]
  future: GraphSpec[]
  selectedColumn?: string
  assign: (role: GraphRole, columnId?: string) => void
  moveAssignment: (columnId: string, toRole?: GraphRole, fromRole?: GraphRole) => void
  updateSpec: (patch: Partial<GraphSpec>) => void
  setElement: (element: GraphElement) => void
  setSelectedColumn: (columnId?: string) => void
  setDataset: (dataset: Dataset) => void
  updateColumn: (columnId: string, patch: Partial<Pick<DataColumn, 'name' | 'dataType' | 'modelingType' | 'unit'>>) => void
  updateCell: (rowId: string, columnId: string, value: CellValue) => void
  setRowExcluded: (rowId: string, excluded: boolean) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

const copy = (spec: GraphSpec): GraphSpec => ({ ...spec })

export const moveRoleAssignment = (spec: GraphSpec, columnId: string, toRole?: GraphRole, fromRole?: GraphRole): GraphSpec => {
  const next = copy(spec)
  if (fromRole && fromRole !== toRole) delete next[fromRole]
  if (!toRole) return next

  // Version 1 uses Wrap as an alternative to the Group X/Y matrix.
  if (toRole === 'wrap') {
    delete next.groupX
    delete next.groupY
  } else if (toRole === 'groupX' || toRole === 'groupY') {
    delete next.wrap
  }

  next[toRole] = columnId
  return next
}

const sameAssignments = (left: GraphSpec, right: GraphSpec) =>
  left.x === right.x && left.y === right.y && left.color === right.color &&
  left.groupX === right.groupX && left.groupY === right.groupY && left.wrap === right.wrap &&
  left.overlay === right.overlay && left.size === right.size

export const useBuilderStore = create<BuilderState>((set) => ({
  dataset: sampleDataset,
  spec: initialSpec,
  past: [],
  future: [],
  assign: (role, columnId) =>
    set((state) => ({ past: [...state.past, copy(state.spec)], spec: { ...state.spec, [role]: columnId }, future: [] })),
  moveAssignment: (columnId, toRole, fromRole) =>
    set((state) => {
      const spec = moveRoleAssignment(state.spec, columnId, toRole, fromRole)
      if (sameAssignments(state.spec, spec)) return state
      return { past: [...state.past, copy(state.spec)], spec, future: [] }
    }),
  updateSpec: (patch) =>
    set((state) => ({ past: [...state.past, copy(state.spec)], spec: { ...state.spec, ...patch }, future: [] })),
  setElement: (element) =>
    set((state) => state.spec.element === element ? state : ({
      past: [...state.past, copy(state.spec)], spec: { ...state.spec, element }, future: [],
    })),
  setSelectedColumn: (selectedColumn) => set({ selectedColumn }),
  setDataset: (dataset) => set({ dataset, spec: defaultGraphSpec(dataset), past: [], future: [], selectedColumn: undefined }),
  updateColumn: (columnId, patch) => set((state) => {
    const previousColumn = state.dataset.columns.find((column) => column.id === columnId)
    if (!previousColumn) return state
    const nextType = patch.dataType ?? previousColumn.dataType
    const typeChanged = nextType !== previousColumn.dataType
    return {
      dataset: {
        ...state.dataset,
        columns: state.dataset.columns.map((column) => column.id === columnId ? { ...column, ...patch } : column),
        rows: typeChanged ? state.dataset.rows.map((row) => ({
          ...row,
          values: { ...row.values, [columnId]: coerceValue(row.values[columnId], nextType) },
        })) : state.dataset.rows,
      },
    }
  }),
  updateCell: (rowId, columnId, value) => set((state) => {
    const column = state.dataset.columns.find((candidate) => candidate.id === columnId)
    if (!column) return state
    return { dataset: { ...state.dataset, rows: state.dataset.rows.map((row) => row.id === rowId ? {
      ...row, values: { ...row.values, [columnId]: coerceValue(value, column.dataType) },
    } : row) } }
  }),
  setRowExcluded: (rowId, excluded) => set((state) => ({
    dataset: { ...state.dataset, rows: state.dataset.rows.map((row) => row.id === rowId ? { ...row, excluded } : row) },
  })),
  undo: () => set((state) => {
    const previous = state.past.at(-1)
    if (!previous) return state
    return { spec: previous, past: state.past.slice(0, -1), future: [copy(state.spec), ...state.future] }
  }),
  redo: () => set((state) => {
    const next = state.future[0]
    if (!next) return state
    return { spec: next, past: [...state.past, copy(state.spec)], future: state.future.slice(1) }
  }),
  reset: () => set({
    dataset: sampleDataset,
    spec: initialSpec,
    past: [],
    future: [],
    selectedColumn: undefined,
  }),
}))
