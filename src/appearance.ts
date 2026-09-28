import type { AxisAppearance, CellValue, DataColumn, DataRow, GraphSpec } from './types'
import { stableCategoryOrder } from './plotTransforms'

export const palettes = {
  standard: ['#0f6c75', '#ef8354', '#665191', '#2f4858', '#d45087', '#73a942'],
  colorblind: ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442'],
  monochrome: ['#243746', '#466277', '#688298', '#91a5b4', '#b9c5ce'],
} as const

export const themes = {
  light: { paper: '#ffffff', plot: '#fbfcfd', ink: '#24313a', grid: '#e5e9ed' },
  dark: { paper: '#202b33', plot: '#26353f', ink: '#eef5f5', grid: '#465660' },
  paper: { paper: '#ffffff', plot: '#ffffff', ink: '#181818', grid: '#d5d5d5' },
} as const

export const axisConfiguration = (settings: AxisAppearance = {}, values: CellValue[], kind: 'number' | 'date' | 'category', categories?: string[]) => {
  const scale = settings.scale ?? 'linear'
  if (scale === 'log' && kind !== 'number') return { error: 'Log scale requires a numeric axis.' }
  if (scale === 'log' && values.some((value) => value !== null && Number.isFinite(Number(value)) && Number(value) <= 0)) return { error: 'Log scale needs values above zero. Filter or exclude zero and negative values first.' }
  if (scale === 'log' && (settings.forceZero || (settings.min !== undefined && settings.min <= 0) || (settings.max !== undefined && settings.max <= 0))) return { error: 'Log scale bounds must be above zero; turn off Force zero.' }
  if (settings.min !== undefined && settings.max !== undefined && settings.min >= settings.max) return { error: 'Axis minimum must be less than maximum.' }
  if (settings.tickInterval !== undefined && settings.tickInterval <= 0) return { error: 'Tick interval must be greater than zero.' }
  const numeric = values.filter((value) => value !== null && value !== '').map(Number).filter(Number.isFinite)
  const dataMin = numeric.length ? Math.min(...numeric) : scale === 'log' ? 1 : 0
  const dataMax = numeric.length ? Math.max(...numeric) : scale === 'log' ? 10 : 1
  const min = settings.forceZero && scale !== 'log' && kind === 'number' ? Math.min(0, settings.min ?? dataMin) : settings.min
  const max = settings.forceZero && scale !== 'log' && kind === 'number' ? Math.max(0, settings.max ?? dataMax) : settings.max
  const range = kind === 'number' && (min !== undefined || max !== undefined)
    ? [min ?? dataMin, max ?? dataMax] : undefined
  if (range && range[0] === range[1] && settings.min === undefined && settings.max === undefined) range[1] = range[0] + 1
  if (range && range[0] >= range[1]) return { error: 'Axis bounds must span the plotted values.' }
  const plotRange = range && scale === 'log' ? range.map(Math.log10) : range
  return { axis: {
    type: kind === 'category' ? 'category' : kind === 'date' ? 'date' : scale,
    ...(categories ? { categoryorder: 'array', categoryarray: categories } : {}),
    ...(plotRange ? { range: settings.reversed ? [...plotRange].reverse() : plotRange, autorange: false } : { autorange: settings.reversed ? 'reversed' : true, ...(settings.forceZero && kind === 'number' ? { rangemode: 'tozero' } : {}) }),
    ...(settings.tickInterval && kind === 'number' ? { dtick: settings.tickInterval } : {}),
    ...(settings.tickInterval && kind === 'date' ? { dtick: settings.tickInterval * 24 * 60 * 60 * 1000 } : {}),
  } }
}

export const orderedCategories = (rows: DataRow[], column: DataColumn, spec: GraphSpec, preferred: string[] = [], responseId?: string) => {
  const data = stableCategoryOrder(rows.map((row) => row.values[column.id]), column).map(String)
  const mode = spec.categoryOrder ?? 'data'
  if (mode === 'alphabetic') return [...data].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  if (mode === 'summary' && responseId) return [...data].sort((a, b) => {
    const mean = (key: string) => {
      const values = rows.filter((row) => String(column.valueLabels?.[String(row.values[column.id])] ?? row.values[column.id]) === key && row.values[responseId] !== null).map((row) => Number(row.values[responseId])).filter(Number.isFinite)
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NEGATIVE_INFINITY
    }
    return mean(b) - mean(a) || data.indexOf(a) - data.indexOf(b)
  })
  const order = mode === 'manual' ? spec.manualCategories ?? [] : preferred
  return [...order.filter((value) => data.includes(value)), ...data.filter((value) => !order.includes(value))]
}
