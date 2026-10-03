import type { AxisAppearance, CellValue, DataColumn, DataRow, GraphSpec } from './types'
import { stableCategoryOrder } from './plotTransforms'

export const palettes = {
  standard: ['#0f6c75', '#258aa6', '#2764a5', '#665191', '#3f8f83', '#5378b8', '#ef8354', '#d45087', '#b85c38', '#ad6a18', '#b84765', '#8760a7'],
  colorblind: ['#0072b2', '#009e73', '#56b4e9', '#225ea8', '#43a2ca', '#238b45', '#e69f00', '#d55e00', '#cc79a7', '#a50f15', '#88419d', '#b8860b'],
  monochrome: ['#243746', '#354c5e', '#466277', '#58758a', '#688298', '#7a91a5', '#91a5b4', '#a6b6c2', '#b9c5ce', '#cbd4dc'],
  vibrant: ['#007f86', '#1687c9', '#515dc2', '#8752b7', '#22a483', '#2573a2', '#f07036', '#db4674', '#c34731', '#d29a11', '#ae4aa0', '#e16a56'],
  earth: ['#246b62', '#527a4e', '#577084', '#75648b', '#398075', '#617a60', '#bd643e', '#af7935', '#a85354', '#946645', '#a86676', '#b58a42'],
} as const

const mixHex = (color: string, target: string, fraction: number) => `#${[0, 2, 4].map((offset) => {
  const from = Number.parseInt(color.slice(offset + 1, offset + 3), 16)
  const to = Number.parseInt(target.slice(offset + 1, offset + 3), 16)
  return Math.round(from + (to - from) * fraction).toString(16).padStart(2, '0')
}).join('')}`

export const pairedYColor = (palette: readonly string[], yIndex: number, groupIndex: number) => {
  const midpoint = Math.ceil(palette.length / 2)
  const colors = yIndex === 0 ? palette.slice(0, midpoint) : palette.slice(midpoint)
  const bank = colors.length ? colors : [palettes.standard[6]]
  const base = bank[groupIndex % bank.length]
  const cycle = Math.floor(groupIndex / bank.length)
  return cycle === 0 ? base : mixHex(base, cycle % 2 ? '#ffffff' : '#000000', Math.min(0.12 + cycle * 0.08, 0.4))
}

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

export const categoryTickLayout = (categories?: string[]) => categories ? {
  automargin: true,
  ...(categories.some((label) => label.length > 16) ? { tickangle: -45 } : {}),
} : {}
