import { errorBarExtent, summaryStatistics, summaryValue, transformSummaryValues } from './statistics'
import { numericOrNaN } from './plotTransforms'
import type { DataRow, ErrorBarType, GraphLayer, SummaryMeasure } from './types'

export interface StatisticalPoint { category: string; value: number | null; n: number | null; rowIds: string[]; error: { plus: number; minus: number } | null }

export const statisticalSeries = (rows: DataRow[], xId: string, yId: string, layer: GraphLayer, measure: SummaryMeasure, errorType: ErrorBarType, weightId?: string): { points: StatisticalPoint[]; warnings: string[] } => {
  const categories = [...new Set(rows.filter((row) => row.values[xId] !== null).map((row) => String(row.values[xId])))]
  const warnings = new Set<string>()
  const confidence = layer.confidenceLevel ?? 0.95
  const points = categories.map((category): StatisticalPoint => {
    const group = rows.filter((row) => String(row.values[xId]) === category)
    if (layer.summaryInput === 'precomputed') {
      if (group.length > 1) warnings.add(`Precomputed category ${category} has multiple rows; only its first row is shown.`)
      const row = group[0]
      const value = numericOrNaN(row.values[yId]); const n = layer.precomputedNColumn ? numericOrNaN(row.values[layer.precomputedNColumn]) : null
      const error = layer.precomputedErrorColumn ? numericOrNaN(row.values[layer.precomputedErrorColumn]) : Number.NaN
      const lower = layer.precomputedLowerColumn ? numericOrNaN(row.values[layer.precomputedLowerColumn]) : Number.NaN
      const upper = layer.precomputedUpperColumn ? numericOrNaN(row.values[layer.precomputedUpperColumn]) : Number.NaN
      if (!Number.isFinite(value)) warnings.add(`Missing summary value for ${category}.`)
      if (errorType !== 'none' && (errorType === 'range' ? !(Number.isFinite(lower) && Number.isFinite(upper) && lower <= value && upper >= value) : !(Number.isFinite(error) && error >= 0))) warnings.add(`Missing or invalid ${errorType === 'range' ? 'lower/upper bounds' : 'uncertainty'} for ${category}.`)
      if (n !== null && (!Number.isInteger(n) || n < 1)) warnings.add(`Invalid sample size for ${category}.`)
      if (n === 1 && errorType !== 'none') warnings.add(`${category} has n = 1; check its supplied uncertainty.`)
      return { category, value: Number.isFinite(value) ? value : null, n: n !== null && Number.isInteger(n) && n > 0 ? n : null, rowIds: [row.id], error: errorType === 'none' || !Number.isFinite(value) ? null : errorType === 'range' ? Number.isFinite(lower) && Number.isFinite(upper) && lower <= value && upper >= value ? { plus: upper - value, minus: value - lower } : null : Number.isFinite(error) && error >= 0 ? { plus: error, minus: error } : null }
    }
    const values = group.map((row) => numericOrNaN(row.values[yId])); const weights = weightId ? group.map((row) => numericOrNaN(row.values[weightId])) : undefined
    const summary = summaryStatistics(values, weights, confidence)
    if (summary.n === 0) warnings.add(`No valid observations for ${category}.`)
    if (summary.n < 2 && (measure === 'sd' || measure === 'se')) warnings.add(`${category} has fewer than two observations; ${measure.toUpperCase()} is unavailable.`)
    if (errorType !== 'none' && summary.n < 2) warnings.add(`${category} has fewer than two observations; ${errorType.toUpperCase()} is unavailable.`)
    return { category, value: summaryValue(summary, measure, layer.quantile ?? 0.5, values, weights), n: summary.n, rowIds: group.map((row) => row.id), error: errorType === 'none' || summary.n < 2 ? null : errorBarExtent(summary, errorType) }
  })
  const transformed = transformSummaryValues(points.map((point) => point.value), categories, layer.valueTransform, layer.controlCategory)
  if (transformed.error) warnings.add(transformed.error)
  return { points: points.map((point, index) => ({ ...point, value: transformed.values[index], error: point.error && transformed.factor !== null ? { plus: Math.abs(point.error.plus * transformed.factor), minus: Math.abs(point.error.minus * transformed.factor) } : null })), warnings: [...warnings] }
}
