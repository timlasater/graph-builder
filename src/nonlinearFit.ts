import { studentTCritical } from './statistics'
import type { GraphLayer } from './types'

export type NonlinearModel = NonNullable<GraphLayer['nonlinearModel']>
export interface ParameterEstimate { name: string; value: number; lower: number | null; upper: number | null }
export interface NonlinearFit {
  model: NonlinearModel
  parameters: ParameterEstimate[]
  rSquared: number
  n: number
  degreesOfFreedom: number
  curve: { x: number[]; y: number[] }
  residuals: { x: number; residual: number; index: number }[]
}

const inverse = (matrix: number[][]): number[][] | null => {
  const n = matrix.length
  const work = matrix.map((row, index) => [...row, ...Array.from({ length: n }, (_, col) => Number(index === col))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(work[row][col]) > Math.abs(work[pivot][col])) pivot = row
    if (Math.abs(work[pivot][col]) < 1e-12) return null
    ;[work[col], work[pivot]] = [work[pivot], work[col]]
    const divisor = work[col][col]
    for (let j = 0; j < 2 * n; j++) work[col][j] /= divisor
    for (let row = 0; row < n; row++) if (row !== col) {
      const factor = work[row][col]
      for (let j = 0; j < 2 * n; j++) work[row][j] -= factor * work[col][j]
    }
  }
  return work.map((row) => row.slice(n))
}

const optimize = (initial: number[], objective: (parameters: number[]) => number) => {
  const n = initial.length
  const simplex = [initial, ...initial.map((_, index) => initial.map((value, col) => col === index ? value + (index >= 2 ? 0.35 : Math.max(0.1, Math.abs(value) * 0.15)) : value))]
  const evaluate = (point: number[]) => ({ point, score: objective(point) })
  let ranked = simplex.map(evaluate)
  for (let iteration = 0; iteration < 700; iteration++) {
    ranked.sort((a, b) => a.score - b.score)
    const spread = Math.max(...ranked.map((item) => Math.abs(item.score - ranked[0].score)))
    if (spread < 1e-12 && iteration > 30) break
    const center = Array.from({ length: n }, (_, col) => ranked.slice(0, n).reduce((sum, item) => sum + item.point[col], 0) / n)
    const worst = ranked[n].point
    const trial = (factor: number) => evaluate(center.map((value, col) => value + factor * (value - worst[col])))
    const reflected = trial(1)
    if (reflected.score < ranked[0].score) {
      const expanded = trial(2)
      ranked[n] = expanded.score < reflected.score ? expanded : reflected
    } else if (reflected.score < ranked[n - 1].score) ranked[n] = reflected
    else {
      const contracted = reflected.score < ranked[n].score ? trial(0.5) : trial(-0.5)
      if (contracted.score < Math.min(reflected.score, ranked[n].score)) ranked[n] = contracted
      else ranked = [ranked[0], ...ranked.slice(1).map((item) => evaluate(item.point.map((value, col) => (value + ranked[0].point[col]) / 2)))]
    }
  }
  ranked.sort((a, b) => a.score - b.score)
  return ranked[0]
}

export function nonlinearFit(xValues: number[], yValues: number[], model: NonlinearModel): { fit?: NonlinearFit; error?: string } {
  const points = xValues.flatMap((x, index) => Number.isFinite(x) && Number.isFinite(yValues[index]) && (model !== 'doseResponse' || x > 0) ? [{ x, y: yValues[index], index }] : [])
  const parameterCount = model === 'doseResponse' ? 4 : 3
  if (points.length <= parameterCount + 1 || new Set(points.map((point) => point.x)).size < parameterCount) return { error: model === 'doseResponse' ? 'Dose–response fitting needs at least six valid positive-X observations at four X values.' : 'Exponential fitting needs at least five valid observations at three X values.' }
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const minX = sorted[0].x; const maxX = sorted.at(-1)!.x
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length
  const totalSS = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0)
  if (totalSS <= 0) return { error: 'A curve cannot be fitted when all Y values are the same.' }
  const predict = (parameters: number[], x: number) => model === 'doseResponse'
    ? parameters[0] + (parameters[1] - parameters[0]) / (1 + Math.exp(Math.max(-700, Math.min(700, Math.exp(Math.max(-12, Math.min(12, parameters[3]))) * (parameters[2] - Math.log(x))))))
    : parameters[0] + parameters[1] * Math.exp(-Math.exp(Math.max(-20, Math.min(20, parameters[2]))) * (x - minX))
  const objective = (parameters: number[]) => {
    const sum = points.reduce((total, point) => total + (point.y - predict(parameters, point.x)) ** 2, 0)
    return Number.isFinite(sum) ? sum : Number.POSITIVE_INFINITY
  }
  const first = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 4))).reduce((sum, point) => sum + point.y, 0) / Math.max(2, Math.floor(sorted.length / 4))
  const last = sorted.slice(-Math.max(2, Math.floor(sorted.length / 4))).reduce((sum, point) => sum + point.y, 0) / Math.max(2, Math.floor(sorted.length / 4))
  const starts = model === 'doseResponse'
    ? [0.5, 1, 2].map((hill) => [first, last, Math.log(sorted[Math.floor(sorted.length / 2)].x), Math.log(hill)])
    : [0.3, 1, 3].map((speed) => [last, first - last, Math.log(speed / (maxX - minX))])
  const best = starts.map((start) => optimize(start, objective)).sort((a, b) => a.score - b.score)[0]
  if (!Number.isFinite(best.score) || best.score >= totalSS * 0.999999) return { error: 'The selected curve did not improve on a flat line. Try another model or check the X and Y assignments.' }
  const p = best.point
  const actual = model === 'doseResponse' ? [p[0], p[1], Math.exp(p[2]), Math.exp(p[3])] : [p[0], p[1], Math.exp(p[2])]
  const names = model === 'doseResponse' ? ['Bottom', 'Top', 'EC50', 'Hill slope'] : ['Plateau', 'Amplitude', 'Rate']
  const df = points.length - parameterCount
  const residuals = points.map((point) => ({ x: point.x, residual: point.y - predict(p, point.x), index: point.index }))
  const jacobian = points.map((point) => p.map((value, col) => {
    const step = 1e-5 * Math.max(1, Math.abs(value))
    const higher = [...p]; const lower = [...p]; higher[col] += step; lower[col] -= step
    return (predict(higher, point.x) - predict(lower, point.x)) / (2 * step)
  }))
  const information = p.map((_, row) => p.map((__, col) => jacobian.reduce((sum, derivatives) => sum + derivatives[row] * derivatives[col], 0)))
  const covariance = inverse(information)
  const critical = studentTCritical(0.95, df)
  const parameters = actual.map((value, index) => {
    const scale = index >= 2 ? value : 1
    const se = covariance && covariance[index][index] >= 0 ? Math.sqrt(covariance[index][index] * best.score / df) * scale : null
    return { name: names[index], value, lower: se !== null && critical !== null ? value - critical * se : null, upper: se !== null && critical !== null ? value + critical * se : null }
  })
  const curveX = Array.from({ length: 150 }, (_, index) => model === 'doseResponse' ? Math.exp(Math.log(minX) + index / 149 * (Math.log(maxX) - Math.log(minX))) : minX + index / 149 * (maxX - minX))
  return { fit: { model, parameters, rSquared: 1 - best.score / totalSS, n: points.length, degreesOfFreedom: df, curve: { x: curveX, y: curveX.map((x) => predict(p, x)) }, residuals } }
}
