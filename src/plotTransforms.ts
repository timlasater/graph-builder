import type { CellValue, DataColumn, DataRow } from './types'

const uniqueValues = (values: CellValue[]) => [...new Map(values.map((value) => [String(value), value])).values()]

export const stableCategoryOrder = (values: CellValue[], column: DataColumn) => {
  const unique = uniqueValues(values).filter((value) => value !== null)
  let ordered = unique
  if (column.dataType === 'boolean') {
    ordered = [false, true].filter((value) => unique.includes(value))
  } else if (column.modelingType === 'ordinal') {
    ordered = [...unique].sort((left, right) => {
      const leftNumber = Number(left); const rightNumber = Number(right)
      return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
        ? leftNumber - rightNumber
        : String(left).localeCompare(String(right), undefined, { numeric: true })
    })
  }
  return ordered.map((value) => column.valueLabels?.[String(value)] ?? value)
}

export const weightedMean = (values: number[], weights?: number[]) => {
  const usable = values.map((value, index) => ({ value, weight: weights?.[index] ?? 1 })).filter(({ value, weight }) => Number.isFinite(value) && Number.isFinite(weight) && weight > 0)
  const totalWeight = usable.reduce((sum, item) => sum + item.weight, 0)
  return totalWeight ? usable.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight : null
}

export const linearFit = (x: number[], y: number[]) => {
  const pairs = x.map((value, index) => ({ x: value, y: y[index] })).filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y))
  if (pairs.length < 2) return null
  const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length
  const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length
  const denominator = pairs.reduce((sum, pair) => sum + (pair.x - meanX) ** 2, 0)
  if (!denominator) return null
  const slope = pairs.reduce((sum, pair) => sum + (pair.x - meanX) * (pair.y - meanY), 0) / denominator
  const intercept = meanY - slope * meanX
  const bounds = [Math.min(...pairs.map((pair) => pair.x)), Math.max(...pairs.map((pair) => pair.x))]
  return { x: bounds, y: bounds.map((value) => intercept + slope * value), slope, intercept }
}

export const histogramBins = (values: number[], requestedBins = 10, domain?: [number, number]) => {
  const usable = values.filter(Number.isFinite); if (!usable.length) return { centers: [], counts: [], width: 0 }
  const minimum = domain?.[0] ?? Math.min(...usable); const maximum = domain?.[1] ?? Math.max(...usable); const binCount = Math.max(1, Math.round(requestedBins))
  if (minimum === maximum) return { centers: [minimum], counts: [usable.length], width: 1 }
  const width = (maximum - minimum) / binCount; const counts = Array.from({ length: binCount }, () => 0)
  usable.forEach((value) => { counts[Math.min(binCount - 1, Math.floor((value - minimum) / width))] += 1 })
  return { centers: counts.map((_, index) => minimum + (index + 0.5) * width), counts, width }
}

export const aggregateBars = (x: unknown[], y: number[], aggregation: 'mean' | 'sum' | 'count' = 'mean') => {
  const groups = [...new Set(x.filter((value) => value !== null).map(String))]
  return groups.map((key) => {
    const values = y.filter((value, index) => String(x[index]) === key && Number.isFinite(value))
    const value = aggregation === 'count' ? values.length : aggregation === 'sum' ? values.reduce((sum, item) => sum + item, 0) : values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null
    return { key, value, n: values.length }
  })
}

const quantile = (sorted: number[], probability: number) => { const position = (sorted.length - 1) * probability; const base = Math.floor(position); const remainder = position - base; return sorted[base] + (sorted[base + 1] === undefined ? 0 : remainder * (sorted[base + 1] - sorted[base])) }
export const boxSummary = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right); if (!sorted.length) return null
  const q1 = quantile(sorted, 0.25); const median = quantile(sorted, 0.5); const q3 = quantile(sorted, 0.75); const iqr = q3 - q1; const lowerFence = q1 - 1.5 * iqr; const upperFence = q3 + 1.5 * iqr
  const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence)
  return { q1, median, q3, lowerWhisker: inliers[0], upperWhisker: inliers.at(-1)!, outliers: sorted.filter((value) => value < lowerFence || value > upperFence) }
}

export const sortedSeries = (x: unknown[], y: number[]) => x.map((value, index) => ({ x: value, y: y[index] })).filter((point) => point.x !== null && Number.isFinite(point.y)).sort((left, right) => {
  const numeric = Number(left.x) - Number(right.x); return Number.isFinite(numeric) ? numeric : String(left.x).localeCompare(String(right.x), undefined, { numeric: true })
})

export const stackCompatibility = (rows: DataRow[], xColumnId?: string, groupColumnId?: string) => {
  if (!xColumnId || !groupColumnId) return { compatible: false, reason: 'Assign Color or Overlay to create series before stacking.' }
  const groups = [...new Set(rows.map((row) => String(row.values[groupColumnId])))]
  if (groups.length < 2) return { compatible: false, reason: 'At least two visible series are required for stacking.' }
  const signatures = groups.map((group) => [...new Set(rows.filter((row) => String(row.values[groupColumnId]) === group).map((row) => String(row.values[xColumnId])))].sort().join('\u0000'))
  return new Set(signatures).size === 1 ? { compatible: true } : { compatible: false, reason: 'Series have different X values; stacking would imply missing values are zero.' }
}
