export type DataType = 'number' | 'text' | 'date' | 'boolean'
export type ModelingType = 'continuous' | 'nominal' | 'ordinal'
export type GraphRole = 'x' | 'y' | 'color' | 'groupX' | 'groupY' | 'wrap' | 'overlay' | 'size' | 'shape' | 'weight' | 'page'
export type GraphElement = 'points' | 'line' | 'bar' | 'histogram' | 'box' | 'area' | 'summary' | 'fit'
export type ErrorBarType = 'none' | 'sd' | 'se' | 'ci' | 'range'
export type BarAggregation = 'mean' | 'sum' | 'count'
export type BoxPointMode = 'outliers' | 'all' | 'none'

export type CellValue = string | number | boolean | null

export interface DataColumn {
  id: string
  name: string
  dataType: DataType
  modelingType: ModelingType
  unit?: string
  formula?: string
  valueLabels?: Record<string, string>
}

export interface DataRow {
  id: string
  excluded: boolean
  values: Record<string, CellValue>
}

export interface Dataset {
  name: string
  columns: DataColumn[]
  rows: DataRow[]
  warnings: DataWarning[]
  importedAnnotations?: ImportedAnnotations
  source?: DatasetSource
}

export interface ImportedAnnotations {
  referenceLines: ReferenceLine[]
  referenceRegions: ReferenceRegion[]
}

export interface DatasetSource {
  fileName: string
  sheetName?: string
  handleId?: string
}

export interface DataWarning {
  code: 'duplicate-heading' | 'empty-heading' | 'mixed-types' | 'invalid-date' | 'lossy-coercion' | 'formula' | 'annotation'
  message: string
  columnId?: string
  rowId?: string
}

export interface RowFilter {
  id: string
  columnId: string
  operator: 'equals' | 'notEquals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'isMissing' | 'isNotMissing' | 'in' | 'between' | 'dateBetween'
  value?: CellValue
  values?: CellValue[]
  min?: number
  max?: number
  start?: string
  end?: string
}

export interface GraphSpec {
  title: string
  subtitle: string
  x: string[]
  y: string[]
  color?: string
  groupX?: string
  groupY?: string
  wrap?: string
  overlay?: string
  size?: string
  shape?: string
  weight?: string
  page?: string
  pageValue?: CellValue
  layers: GraphLayer[]
  activeLayerId: string
  showGrid: boolean
  markerSize: number
  xAxis?: AxisAppearance
  yAxis?: AxisAppearance
  categoryOrder?: 'data' | 'alphabetic' | 'summary' | 'manual'
  manualCategories?: string[]
  fontFamily?: string
  fontSize?: number
  graphWidth?: number
  graphHeight?: number
  aspectRatio?: number
  markerShape?: string
  markerOpacity?: number
  markerJitter?: number
  lineStyle?: 'solid' | 'dash' | 'dot' | 'dashdot'
  barGap?: number
  barWidth?: number
  errorCap?: number
  errorThickness?: number
  errorColor?: string
  palette?: string[]
  theme?: 'light' | 'dark' | 'paper'
  legendPlacement?: 'bottom' | 'top' | 'right' | 'hidden'
  seriesNames?: Record<string, string>
  legendOrder?: string[]
  seriesColors?: Record<string, string>
  hiddenSeries?: string[]
  highlightedSeries?: string
  facetScale?: 'shared' | 'independent'
  panels?: GraphPanel[]
  referenceLines?: ReferenceLine[]
  referenceRegions?: ReferenceRegion[]
}

export interface GraphPanel { id: string; title: string; x?: string; y?: string }

export interface AxisAppearance {
  scale?: 'linear' | 'log'
  min?: number
  max?: number
  reversed?: boolean
  forceZero?: boolean
  tickInterval?: number
  title?: string
}

export interface ReferenceLine { id: string; axis: 'x' | 'y'; value: number; label?: string; color: string }
export interface ReferenceRegion { id: string; axis: 'x' | 'y'; min: number; max: number; label?: string; color: string }

export interface GraphLayer {
  id: string
  name: string
  element: GraphElement
  x?: string
  y?: string
  color?: string
  colorHex?: string
  markerSize?: number
  lineWidth?: number
  lineStyle?: 'solid' | 'dash' | 'dot' | 'dashdot'
  markerShape?: string
  errorCap?: number
  errorThickness?: number
  errorColor?: string
  errorBar?: ErrorBarType
  confidenceLevel?: number
  showObservations?: boolean
  binCount?: number
  boxPoints?: BoxPointMode
  barAggregation?: BarAggregation
  stack?: boolean
  showEquation?: boolean
  showRSquared?: boolean
  fixedIntercept?: number
}
