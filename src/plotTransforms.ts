import type { CellValue, DataColumn } from './types'

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
