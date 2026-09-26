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

export const numericOrNaN = (value: unknown) => value === null || value === undefined || value === '' ? Number.NaN : Number(value)

export const orderByPreference = (values: string[], preferred: string[] = []) => {
  const available = new Set(values); const used = new Set<string>()
  const ordered: string[] = []
  preferred.forEach((value) => { if (available.has(value) && !used.has(value)) { used.add(value); ordered.push(value) } })
  return [...ordered, ...values.filter((value) => !used.has(value))]
}

export const moveOrderedValue = (values: string[], source: string, target: string) => {
  const from = values.indexOf(source); const to = values.indexOf(target)
  if (from < 0 || to < 0 || from === to) return values
  const next = [...values]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved)
  return next
}

export const linearFit = (x: number[], y: number[], weights?: number[], fixedIntercept?: number) => {
  const pairs = x.map((value, index) => ({ x: value, y: y[index], weight: weights?.[index] ?? 1 })).filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y) && Number.isFinite(pair.weight) && pair.weight > 0)
  if (pairs.length < 2) return null
  const weightTotal = pairs.reduce((sum, pair) => sum + pair.weight, 0)
  const meanX = pairs.reduce((sum, pair) => sum + pair.x * pair.weight, 0) / weightTotal
  const meanY = pairs.reduce((sum, pair) => sum + pair.y * pair.weight, 0) / weightTotal
  const denominator = fixedIntercept === undefined
    ? pairs.reduce((sum, pair) => sum + pair.weight * (pair.x - meanX) ** 2, 0)
    : pairs.reduce((sum, pair) => sum + pair.weight * pair.x ** 2, 0)
  if (!denominator) return null
  const slope = fixedIntercept === undefined
    ? pairs.reduce((sum, pair) => sum + pair.weight * (pair.x - meanX) * (pair.y - meanY), 0) / denominator
    : pairs.reduce((sum, pair) => sum + pair.weight * pair.x * (pair.y - fixedIntercept), 0) / denominator
  const intercept = fixedIntercept ?? meanY - slope * meanX
  const residualSumSquares = pairs.reduce((sum, pair) => sum + pair.weight * (pair.y - (slope * pair.x + intercept)) ** 2, 0)
  const totalSumSquares = pairs.reduce((sum, pair) => sum + pair.weight * (pair.y - meanY) ** 2, 0)
  const rSquared = totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : undefined
  const bounds = [Math.min(...pairs.map((pair) => pair.x)), Math.max(...pairs.map((pair) => pair.x))]
  return { x: bounds, y: bounds.map((value) => intercept + slope * value), slope, intercept, rSquared }
}

export const histogramBins = (values: number[], requestedBins = 10, domain?: [number, number], weights?: number[]) => {
  const usable = values.map((value, index) => ({ value, weight: weights?.[index] ?? 1 })).filter((item) => Number.isFinite(item.value) && Number.isFinite(item.weight) && item.weight > 0); if (!usable.length) return { centers: [], counts: [], width: 0 }
  const minimum = domain?.[0] ?? Math.min(...usable.map((item) => item.value)); const maximum = domain?.[1] ?? Math.max(...usable.map((item) => item.value)); const binCount = Math.max(1, Math.round(requestedBins))
  if (minimum === maximum) return { centers: [minimum], counts: [usable.reduce((sum, item) => sum + item.weight, 0)], width: 1 }
  const width = (maximum - minimum) / binCount; const counts = Array.from({ length: binCount }, () => 0)
  usable.forEach(({ value, weight }) => { counts[Math.max(0, Math.min(binCount - 1, Math.floor((value - minimum) / width)))] += weight })
  return { centers: counts.map((_, index) => minimum + (index + 0.5) * width), counts, width }
}

export const aggregateBars = (x: unknown[], y: number[], aggregation: 'mean' | 'sum' | 'count' = 'mean', weights?: number[]) => {
  const groups = [...new Set(x.filter((value) => value !== null).map(String))]
  return groups.map((key) => {
    const values = y.map((value, index) => ({ value, weight: weights?.[index] ?? 1, key: String(x[index]) })).filter((item) => item.key === key && Number.isFinite(item.value) && Number.isFinite(item.weight) && item.weight > 0)
    const n = values.reduce((sum, item) => sum + item.weight, 0)
    const value = aggregation === 'count' ? n : aggregation === 'sum' ? values.reduce((sum, item) => sum + item.value * item.weight, 0) : n ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / n : null
    return { key, value, n }
  })
}

const quantile = (sorted: number[], probability: number) => { const position = (sorted.length - 1) * probability; const base = Math.floor(position); const remainder = position - base; return sorted[base] + (sorted[base + 1] === undefined ? 0 : remainder * (sorted[base + 1] - sorted[base])) }
export const boxSummary = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right); if (!sorted.length) return null
  const q1 = quantile(sorted, 0.25); const median = quantile(sorted, 0.5); const q3 = quantile(sorted, 0.75); const iqr = q3 - q1; const lowerFence = q1 - 1.5 * iqr; const upperFence = q3 + 1.5 * iqr
  const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence)
  return { q1, median, q3, lowerWhisker: inliers[0], upperWhisker: inliers.at(-1)!, outliers: sorted.filter((value) => value < lowerFence || value > upperFence) }
}

export const sortedSeries = (x: unknown[], y: number[]) => x.map((value, index) => ({ x: value, y: y[index], index })).filter((point) => point.x !== null && Number.isFinite(point.y)).sort((left, right) => {
  const numeric = Number(left.x) - Number(right.x); return Number.isFinite(numeric) ? numeric : String(left.x).localeCompare(String(right.x), undefined, { numeric: true })
})

export const stackCompatibility = (rows: DataRow[], xColumnId?: string, groupColumnId?: string) => {
  if (!xColumnId || !groupColumnId) return { compatible: false, reason: 'Assign Color or Overlay to create series before stacking.' }
  const groups = [...new Set(rows.map((row) => String(row.values[groupColumnId])))]
  if (groups.length < 2) return { compatible: false, reason: 'At least two visible series are required for stacking.' }
  const signatures = groups.map((group) => [...new Set(rows.filter((row) => String(row.values[groupColumnId]) === group).map((row) => String(row.values[xColumnId])))].sort().join('\u0000'))
  return new Set(signatures).size === 1 ? { compatible: true } : { compatible: false, reason: 'Series have different X values; stacking would imply missing values are zero.' }
}
