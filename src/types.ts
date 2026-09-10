export type DataType = 'number' | 'text' | 'date' | 'boolean'
export type ModelingType = 'continuous' | 'nominal' | 'ordinal'
export type GraphRole = 'x' | 'y' | 'color' | 'groupX' | 'groupY' | 'wrap' | 'overlay' | 'size' | 'shape' | 'weight' | 'page'
export type GraphElement = 'points' | 'line' | 'bar' | 'summary' | 'fit'
export type ErrorBarType = 'none' | 'sd' | 'se' | 'ci95' | 'range'

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
}

export interface DataWarning {
  code: 'duplicate-heading' | 'empty-heading' | 'mixed-types' | 'invalid-date' | 'lossy-coercion' | 'formula'
  message: string
  columnId?: string
  rowId?: string
}

export interface RowFilter {
  id: string
  columnId: string
  operator: 'equals' | 'notEquals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'isMissing' | 'isNotMissing' | 'in' | 'between'
  value?: CellValue
  values?: CellValue[]
  min?: number
  max?: number
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
}

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
  errorBar?: ErrorBarType
}
