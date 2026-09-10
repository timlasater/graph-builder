export type DataType = 'number' | 'text' | 'date' | 'boolean'
export type ModelingType = 'continuous' | 'nominal' | 'ordinal'
export type GraphRole = 'x' | 'y' | 'color' | 'groupX' | 'groupY' | 'wrap' | 'overlay' | 'size'
export type GraphElement = 'points' | 'line' | 'bar'

export type CellValue = string | number | boolean | null

export interface DataColumn {
  id: string
  name: string
  dataType: DataType
  modelingType: ModelingType
  unit?: string
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
}

export interface GraphSpec {
  title: string
  subtitle: string
  x?: string
  y?: string
  color?: string
  groupX?: string
  groupY?: string
  wrap?: string
  overlay?: string
  size?: string
  element: GraphElement
  showGrid: boolean
  markerSize: number
}
