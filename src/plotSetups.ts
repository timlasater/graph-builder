import type { Dataset, GraphSpec, RowFilter } from './types'

const STORAGE_KEY = 'graph-builder.plot-setups.v1'

export interface SavedPlotSetup {
  version: 1
  id: string
  name: string
  sourceName: string
  sourceSignature: string
  createdAt: string
  updatedAt: string
  spec: GraphSpec
  filters: RowFilter[]
}

export const datasetSignature = (dataset: Pick<Dataset, 'columns'>) => JSON.stringify(dataset.columns.map((column) => [column.id, column.dataType, column.modelingType]))

const isSavedPlotSetup = (value: unknown): value is SavedPlotSetup => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SavedPlotSetup>
  return candidate.version === 1 && typeof candidate.id === 'string' && typeof candidate.name === 'string' && typeof candidate.sourceName === 'string' && typeof candidate.sourceSignature === 'string' && typeof candidate.createdAt === 'string' && typeof candidate.updatedAt === 'string' && Boolean(candidate.spec && typeof candidate.spec === 'object') && Array.isArray(candidate.filters)
}

export const readPlotSetups = (storage: Storage = window.localStorage): SavedPlotSetup[] => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isSavedPlotSetup) : []
  } catch {
    return []
  }
}

export const writePlotSetups = (setups: SavedPlotSetup[], storage: Storage = window.localStorage) => {
  storage.setItem(STORAGE_KEY, JSON.stringify(setups))
}

export const makePlotSetup = (name: string, dataset: Dataset, spec: GraphSpec, filters: RowFilter[], previous?: SavedPlotSetup): SavedPlotSetup => {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Enter a name for this plot setup.')
  const now = new Date().toISOString()
  return {
    version: 1,
    id: previous?.id ?? crypto.randomUUID(),
    name: trimmedName,
    sourceName: dataset.name,
    sourceSignature: datasetSignature(dataset),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    spec: structuredClone(spec),
    filters: structuredClone(filters),
  }
}

export const isSetupCompatible = (setup: SavedPlotSetup, dataset: Dataset) => setup.sourceSignature === datasetSignature(dataset)

