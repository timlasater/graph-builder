import type { ErrorBarType, SummaryMeasure, ValueTransform } from './types'

// Lanczos log-gamma plus a continued-fraction incomplete beta implementation.
// These support the Student's t quantile used for small-sample confidence intervals.
const logGamma = (value: number): number => {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7]
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value)
  const z = value - 1; let series = 0.9999999999998099
  coefficients.forEach((coefficient, index) => { series += coefficient / (z + index + 1) })
  const t = z + coefficients.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series)
}

const betaFraction = (x: number, a: number, b: number) => {
  const maximumIterations = 200; const epsilon = 3e-14; const floor = 1e-300
  const qab = a + b; const qap = a + 1; const qam = a - 1
  let c = 1; let d = 1 - qab * x / qap; if (Math.abs(d) < floor) d = floor
  d = 1 / d; let result = d
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const twice = 2 * iteration
    let term = iteration * (b - iteration) * x / ((qam + twice) * (a + twice)); d = 1 + term * d; if (Math.abs(d) < floor) d = floor; c = 1 + term / c; if (Math.abs(c) < floor) c = floor; d = 1 / d; result *= d * c
    term = -(a + iteration) * (qab + iteration) * x / ((a + twice) * (qap + twice)); d = 1 + term * d; if (Math.abs(d) < floor) d = floor; c = 1 + term / c; if (Math.abs(c) < floor) c = floor; d = 1 / d
    const delta = d * c; result *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return result
}

const regularizedBeta = (x: number, a: number, b: number) => {
  if (x <= 0) return 0; if (x >= 1) return 1
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? factor * betaFraction(x, a, b) / a : 1 - factor * betaFraction(1 - x, b, a) / b
}

export const studentTCdf = (value: number, degreesOfFreedom: number) => {
  const beta = regularizedBeta(degreesOfFreedom / (degreesOfFreedom + value * value), degreesOfFreedom / 2, 0.5)
  return value >= 0 ? 1 - beta / 2 : beta / 2
}

export const studentTCritical = (confidence: number, degreesOfFreedom: number) => {
  if (!(confidence > 0 && confidence < 1) || degreesOfFreedom <= 0) return null
  const target = (1 + confidence) / 2; let low = 0; let high = 1
  while (studentTCdf(high, degreesOfFreedom) < target && high < 1e6) high *= 2
  for (let iteration = 0; iteration < 80; iteration += 1) { const middle = (low + high) / 2; if (studentTCdf(middle, degreesOfFreedom) < target) low = middle; else high = middle }
  return (low + high) / 2
}

export interface SummaryStatistics { n: number; sum: number | null; mean: number | null; median: number | null; q1: number | null; q3: number | null; sd: number | null; se: number | null; confidenceInterval: number | null; minimum: number | null; maximum: number | null }

// Frequency weights represent repeated observations. Quantiles use linear interpolation
// at (n - 1) * p, the same rule used by the box summary.
export const weightedQuantile = (values: number[], probability: number, weights?: number[]): number | null => {
  const sorted = values.map((value, index) => ({ value, weight: weights?.[index] ?? 1 })).filter((item) => Number.isFinite(item.value) && Number.isInteger(item.weight) && item.weight > 0).sort((a, b) => a.value - b.value)
  const n = sorted.reduce((total, item) => total + item.weight, 0)
  if (!n || !Number.isFinite(probability) || probability < 0 || probability > 1) return null
  const atRank = (rank: number) => { let cumulative = 0; for (const item of sorted) { cumulative += item.weight; if (rank < cumulative) return item.value } return sorted.at(-1)!.value }
  const position = (n - 1) * probability; const low = Math.floor(position)
  return atRank(low) + (atRank(Math.ceil(position)) - atRank(low)) * (position - low)
}

export const summaryStatistics = (values: number[], weights?: number[], confidence = 0.95): SummaryStatistics => {
  const usable = values.map((value, index) => ({ value, weight: weights?.[index] ?? 1 })).filter(({ value, weight }) => Number.isFinite(value) && Number.isFinite(weight) && weight > 0)
  if (!usable.length) return { n: 0, sum: null, mean: null, median: null, q1: null, q3: null, sd: null, se: null, confidenceInterval: null, minimum: null, maximum: null }
  const weightTotal = usable.reduce((sum, item) => sum + item.weight, 0); const sum = usable.reduce((total, item) => total + item.value * item.weight, 0); const mean = sum / weightTotal
  const variance = weightTotal > 1 ? usable.reduce((sum, item) => sum + item.weight * (item.value - mean) ** 2, 0) / (weightTotal - 1) : null
  const sd = variance === null ? null : Math.sqrt(variance); const se = sd === null ? null : sd / Math.sqrt(weightTotal); const critical = studentTCritical(confidence, weightTotal - 1)
  return { n: weightTotal, sum, mean, median: weightedQuantile(values, 0.5, weights), q1: weightedQuantile(values, 0.25, weights), q3: weightedQuantile(values, 0.75, weights), sd, se, confidenceInterval: se !== null && critical !== null ? se * critical : null, minimum: Math.min(...usable.map((item) => item.value)), maximum: Math.max(...usable.map((item) => item.value)) }
}

export const summaryValue = (summary: SummaryStatistics, measure: SummaryMeasure, quantile = 0.5, values?: number[], weights?: number[]): number | null => {
  if (measure === 'count') return summary.n
  if (measure === 'min') return summary.minimum
  if (measure === 'max') return summary.maximum
  if (measure === 'quantile') return values ? weightedQuantile(values, quantile, weights) : null
  return summary[measure]
}

export const transformSummaryValues = (values: (number | null)[], categories: string[], transform: ValueTransform = 'none', controlCategory?: string) => {
  if (transform === 'none') return { values, factor: 1, error: null }
  const denominator = transform === 'percentTotal'
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : values[categories.indexOf(controlCategory ?? '')]
  if (denominator === null || denominator === undefined || !Number.isFinite(denominator) || denominator <= 0) return { values: values.map(() => null), factor: null, error: transform === 'control' ? 'Choose a control category with a positive value.' : 'A positive total is needed for percentage of total.' }
  const factor = 100 / denominator
  return { values: values.map((value) => value === null ? null : value * factor), factor, error: null }
}

export const errorBarExtent = (summary: SummaryStatistics, type: ErrorBarType) => {
  if (summary.mean === null || type === 'none') return null
  if (type === 'range') return summary.minimum === null || summary.maximum === null ? null : { plus: summary.maximum - summary.mean, minus: summary.mean - summary.minimum }
  const amount = type === 'sd' ? summary.sd : type === 'se' ? summary.se : summary.confidenceInterval
  return amount === null ? null : { plus: amount, minus: amount }
}
