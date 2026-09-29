import { datasetSignature } from './datasetSignature'
import { coerceValue } from './importData'
import { recalculateFormulaColumns } from './formula'
import type { DataColumn, Dataset, GraphDocument, GraphSpec, RowFilter } from './types'

export const PROJECT_FORMAT = 'graphbuilder-project'
export const PROJECT_VERSION = 1

export interface ProjectFile {
  format: typeof PROJECT_FORMAT
  version: typeof PROJECT_VERSION
  name: string
  savedAt: string
  data: { mode: 'embedded'; dataset: Dataset } | { mode: 'linked'; source: { fileName: string; sheetName?: string; signature: string }; columns: DataColumn[] }
  graphs: GraphDocument[]
  activeGraphId: string
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')
const cell = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value))
const elements = new Set(['points', 'line', 'bar', 'histogram', 'box', 'area', 'summary', 'fit', 'smooth'])
const operators = new Set(['equals', 'notEquals', 'contains', 'gt', 'gte', 'lt', 'lte', 'isMissing', 'isNotMissing', 'in', 'between', 'dateBetween'])
const optionalString = (object: Record<string, unknown>, key: string) => object[key] === undefined || typeof object[key] === 'string'
const optionalNumber = (object: Record<string, unknown>, key: string) => object[key] === undefined || typeof object[key] === 'number' && Number.isFinite(object[key])
const optionalStrings = (object: Record<string, unknown>, key: string) => object[key] === undefined || strings(object[key])
const optionalStringMap = (object: Record<string, unknown>, key: string) => object[key] === undefined || record(object[key]) && Object.values(object[key]).every((item) => typeof item === 'string')
const validLine = (value: unknown) => record(value) && typeof value.id === 'string' && ['x', 'y'].includes(String(value.axis)) && typeof value.value === 'number' && Number.isFinite(value.value) && typeof value.color === 'string' && optionalString(value, 'label')
const validRegion = (value: unknown) => record(value) && typeof value.id === 'string' && ['x', 'y'].includes(String(value.axis)) && typeof value.min === 'number' && Number.isFinite(value.min) && typeof value.max === 'number' && Number.isFinite(value.max) && value.min < value.max && typeof value.color === 'string' && optionalString(value, 'label')
const optionalItems = (object: Record<string, unknown>, key: string, check: (value: unknown) => boolean) => object[key] === undefined || Array.isArray(object[key]) && object[key].every(check)
const validAxis = (value: unknown) => value === undefined || record(value) && ['scale', 'title'].every((key) => optionalString(value, key)) && ['min', 'max', 'tickInterval'].every((key) => optionalNumber(value, key)) && ['reversed', 'forceZero'].every((key) => value[key] === undefined || typeof value[key] === 'boolean')
const validLayer = (value: unknown) => record(value) && typeof value.id === 'string' && typeof value.name === 'string' && elements.has(String(value.element)) && ['x', 'y', 'color', 'colorHex', 'lineStyle', 'markerShape', 'errorColor', 'boxPoints', 'precomputedErrorColumn', 'precomputedNColumn', 'precomputedLowerColumn', 'precomputedUpperColumn', 'controlCategory'].every((key) => optionalString(value, key)) && ['markerSize', 'lineWidth', 'errorCap', 'errorThickness', 'confidenceLevel', 'binCount', 'fixedIntercept', 'quantile', 'smoothWindow'].every((key) => optionalNumber(value, key)) && ['showObservations', 'stack', 'showEquation', 'showRSquared', 'showSampleSize'].every((key) => value[key] === undefined || typeof value[key] === 'boolean') && (value.errorBar === undefined || ['none', 'sd', 'se', 'ci', 'range'].includes(String(value.errorBar))) && ['barAggregation', 'summaryMeasure'].every((key) => value[key] === undefined || ['mean', 'sum', 'count', 'median', 'min', 'max', 'quantile', 'sd', 'se'].includes(String(value[key]))) && (value.summaryInput === undefined || ['raw', 'precomputed'].includes(String(value.summaryInput))) && (value.valueTransform === undefined || ['none', 'percentTotal', 'control'].includes(String(value.valueTransform))) && (value.quantile === undefined || typeof value.quantile === 'number' && value.quantile >= 0 && value.quantile <= 1) && (value.smoothWindow === undefined || typeof value.smoothWindow === 'number' && Number.isInteger(value.smoothWindow) && value.smoothWindow >= 1 && value.smoothWindow % 2 === 1)
const validColumns = (value: unknown): value is DataColumn[] => Array.isArray(value) && value.length > 0 && value.every((column) => record(column) && typeof column.id === 'string' && column.id.length > 0 && typeof column.name === 'string' && ['number', 'text', 'date', 'boolean'].includes(String(column.dataType)) && ['continuous', 'nominal', 'ordinal'].includes(String(column.modelingType)) && optionalString(column, 'unit') && optionalString(column, 'formula') && optionalStringMap(column, 'valueLabels')) && new Set(value.map((column) => column.id)).size === value.length

const validDataset = (value: unknown): value is Dataset => {
  if (!record(value) || typeof value.name !== 'string' || !Array.isArray(value.columns) || !Array.isArray(value.rows) || !Array.isArray(value.warnings)) return false
  const columns = value.columns
  if (!validColumns(columns)) return false
  const ids = columns.map((column) => column.id)
  if (!value.rows.every((row) => record(row) && typeof row.id === 'string' && typeof row.excluded === 'boolean' && record(row.values) && ids.every((id) => record(row.values) && id in row.values && cell(row.values[id])))) return false
  if (new Set(value.rows.map((row) => row.id)).size !== value.rows.length) return false
  if (!value.warnings.every((warning) => record(warning) && typeof warning.code === 'string' && typeof warning.message === 'string')) return false
  if (value.source !== undefined && (!record(value.source) || typeof value.source.fileName !== 'string' || !optionalString(value.source, 'sheetName') || !optionalString(value.source, 'handleId') || !optionalString(value.source, 'signature'))) return false
  if (value.importedAnnotations !== undefined && (!record(value.importedAnnotations) || !Array.isArray(value.importedAnnotations.referenceLines) || !value.importedAnnotations.referenceLines.every(validLine) || !Array.isArray(value.importedAnnotations.referenceRegions) || !value.importedAnnotations.referenceRegions.every(validRegion))) return false
  return true
}

const validSpec = (value: unknown): value is GraphSpec => {
  if (!record(value) || typeof value.title !== 'string' || typeof value.subtitle !== 'string' || !strings(value.x) || !strings(value.y) || !Array.isArray(value.layers) || !value.layers.length || !value.layers.every(validLayer) || typeof value.activeLayerId !== 'string' || !value.layers.some((layer) => layer.id === value.activeLayerId) || typeof value.showGrid !== 'boolean' || typeof value.markerSize !== 'number' || !Number.isFinite(value.markerSize)) return false
  if (!['color', 'groupX', 'groupY', 'wrap', 'overlay', 'size', 'shape', 'weight', 'page', 'highlightedSeries', 'fontFamily', 'markerShape', 'lineStyle', 'errorColor', 'theme', 'legendPlacement', 'facetScale', 'categoryOrder'].every((key) => optionalString(value, key))) return false
  if (value.xDisplay !== undefined && !['together', 'subplots'].includes(String(value.xDisplay))) return false
  if (value.yDisplay !== undefined && !['together', 'subplots', 'collate'].includes(String(value.yDisplay))) return false
  if (!['fontSize', 'graphWidth', 'graphHeight', 'aspectRatio', 'markerOpacity', 'markerJitter', 'barGap', 'barWidth', 'errorCap', 'errorThickness'].every((key) => optionalNumber(value, key))) return false
  if (value.subplotColumns !== undefined && (typeof value.subplotColumns !== 'number' || !Number.isInteger(value.subplotColumns) || value.subplotColumns < 1)) return false
  if (!['manualCategories', 'palette', 'legendOrder', 'hiddenSeries'].every((key) => optionalStrings(value, key)) || !['seriesNames', 'seriesColors'].every((key) => optionalStringMap(value, key))) return false
  if (!validAxis(value.xAxis) || !validAxis(value.yAxis) || !optionalItems(value, 'referenceLines', validLine) || !optionalItems(value, 'referenceRegions', validRegion)) return false
  if (value.pageValue !== undefined && !cell(value.pageValue)) return false
  return value.panels === undefined || Array.isArray(value.panels) && value.panels.every((panel) => record(panel) && typeof panel.id === 'string' && typeof panel.title === 'string' && optionalString(panel, 'x') && optionalString(panel, 'y') && optionalString(panel, 'xAxisTitle') && optionalString(panel, 'yAxisTitle'))
}

const validFilters = (value: unknown): value is RowFilter[] => Array.isArray(value) && value.every((filter) => record(filter) && typeof filter.id === 'string' && typeof filter.columnId === 'string' && operators.has(String(filter.operator)) && (filter.value === undefined || cell(filter.value)) && (filter.values === undefined || Array.isArray(filter.values) && filter.values.every(cell)) && ['min', 'max'].every((key) => optionalNumber(filter, key)) && ['start', 'end'].every((key) => optionalString(filter, key)))
const validGraphs = (value: unknown): value is GraphDocument[] => Array.isArray(value) && value.length > 0 && value.every((graph) => record(graph) && typeof graph.id === 'string' && graph.id.length > 0 && typeof graph.name === 'string' && graph.name.trim().length > 0 && validSpec(graph.spec) && validFilters(graph.filters)) && new Set(value.map((graph) => graph.id)).size === value.length
const graphsFitColumns = (graphs: GraphDocument[], columns: DataColumn[]) => {
  const ids = new Set(columns.map((column) => column.id))
  return graphs.every((graph) => {
    const spec = graph.spec
    const assigned = [...spec.x, ...spec.y, spec.color, spec.groupX, spec.groupY, spec.wrap, spec.overlay, spec.size, spec.shape, spec.weight, spec.page, ...spec.layers.flatMap((layer) => [layer.x, layer.y, layer.color, layer.precomputedErrorColumn, layer.precomputedNColumn, layer.precomputedLowerColumn, layer.precomputedUpperColumn]), ...(spec.panels ?? []).flatMap((panel) => [panel.x, panel.y]), ...graph.filters.map((filter) => filter.columnId)]
    return assigned.every((id) => !id || ids.has(id))
  })
}

const migrateV0 = (legacy: Record<string, unknown>): ProjectFile => {
  if (!validDataset(legacy.dataset) || !validSpec(legacy.spec) || !validFilters(legacy.filters)) throw new Error('This older project has missing or invalid data and cannot be migrated.')
  const name = typeof legacy.name === 'string' && legacy.name.trim() ? legacy.name : legacy.dataset.name
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, name, savedAt: typeof legacy.savedAt === 'string' ? legacy.savedAt : new Date().toISOString(), data: { mode: 'embedded', dataset: legacy.dataset }, graphs: [{ id: 'graph-1', name: legacy.spec.title.trim() || 'Graph 1', spec: legacy.spec, filters: legacy.filters }], activeGraphId: 'graph-1' }
}

export const parseProject = (content: string): ProjectFile => {
  let value: unknown
  try { value = JSON.parse(content) } catch { throw new Error('This is not valid JSON. The current project was not changed.') }
  if (!record(value) || value.format !== PROJECT_FORMAT) throw new Error('This is not a Graph Builder project file. The current project was not changed.')
  if (value.version === 0) value = migrateV0(value)
  if (!record(value) || value.version !== PROJECT_VERSION) throw new Error('This project uses an unsupported version. The current project was not changed.')
  if (typeof value.name !== 'string' || !value.name.trim() || typeof value.savedAt !== 'string' || !validGraphs(value.graphs) || typeof value.activeGraphId !== 'string' || !value.graphs.some((graph) => graph.id === value.activeGraphId)) throw new Error('This project is incomplete or damaged. The current project was not changed.')
  const data = value.data
  if (!record(data) || data.mode === 'embedded' && !validDataset(data.dataset) || data.mode === 'linked' && (!record(data.source) || typeof data.source.fileName !== 'string' || typeof data.source.signature !== 'string' || data.source.sheetName !== undefined && typeof data.source.sheetName !== 'string' || data.columns !== undefined && !validColumns(data.columns)) || data.mode !== 'embedded' && data.mode !== 'linked') throw new Error('This project has invalid data information. The current project was not changed.')
  const columns = data.mode === 'embedded' ? (data.dataset as Dataset).columns : data.columns as DataColumn[] | undefined
  if (columns && !graphsFitColumns(value.graphs, columns)) throw new Error('This project refers to columns that are missing from its data. The current project was not changed.')
  return structuredClone(value) as unknown as ProjectFile
}

export const makeProject = (name: string, dataset: Dataset, graphs: GraphDocument[], activeGraphId: string, mode: 'embedded' | 'linked'): ProjectFile => {
  if (!name.trim() || !validGraphs(graphs) || !graphs.some((graph) => graph.id === activeGraphId)) throw new Error('The project needs a name and at least one valid graph.')
  if (!graphsFitColumns(graphs, dataset.columns)) throw new Error('A graph or filter refers to a missing column. Fix it before saving the project.')
  if (mode === 'linked' && !dataset.source?.fileName) throw new Error('Linked projects need an imported source file. Use embedded data for the built-in example.')
  const data: ProjectFile['data'] = mode === 'embedded' ? { mode, dataset: structuredClone(dataset) } : { mode, source: { fileName: dataset.source!.fileName, sheetName: dataset.source?.sheetName, signature: dataset.source?.signature ?? datasetSignature({ columns: dataset.columns.filter((column) => !column.formula) }) }, columns: structuredClone(dataset.columns) }
  if (data.mode === 'embedded' && data.dataset.source) delete data.dataset.source.handleId
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, name: name.trim(), savedAt: new Date().toISOString(), data, graphs: structuredClone(graphs), activeGraphId }
}

export const projectJson = (project: ProjectFile) => JSON.stringify(project, null, 2)

export const rebuildLinkedDataset = (imported: Dataset, columns: DataColumn[]): Dataset => {
  if (!validColumns(columns)) throw new Error('The linked project has invalid column settings.')
  const available = new Set(imported.columns.map((column) => column.id))
  if (columns.some((column) => !column.formula && !available.has(column.id))) throw new Error('The selected source file is missing a column used by this project.')
  const rows = imported.rows.map((row) => ({ ...row, values: { ...row.values } }))
  for (const column of columns.filter((item) => !item.formula)) for (const row of rows) row.values[column.id] = coerceValue(row.values[column.id], column.dataType)
  const recalculated = recalculateFormulaColumns(columns, rows)
  return { ...imported, columns: structuredClone(columns), rows: recalculated.rows, warnings: [...imported.warnings, ...recalculated.warnings] }
}
