import { describe, expect, it } from 'vitest'
import { boxSummary, histogramBins, linearFit, smoothedTrend } from './plotTransforms'
import { summaryStatistics } from './statistics'
import { statisticalSeries } from './statisticalSeries'
import type { DataRow, GraphLayer } from './types'

// Independent values produced by scripts/scipy_reference.py with SciPy 1.18.1
// and NumPy 2.3.5. The reference script imports no Graph Builder code.
describe('free SciPy statistical reference', () => {
  const groups = {
    A: { values: [4, 5, 7, 9], n: 4, mean: 6.25, sd: 2.217355782608345, se: 1.1086778913041726, ci: 3.528307858930696, q1: 4.75, median: 6, q3: 7.5 },
    B: { values: [10, 12, 13], n: 3, mean: 11.666666666666666, sd: 1.5275252316519468, se: 0.881917103688197, ci: 3.79458303359676, q1: 11, median: 12, q3: 12.5 },
    C: { values: [8], n: 1, mean: 8, sd: null, se: null, ci: null, q1: 8, median: 8, q3: 8 },
  }

  it('matches grouped summaries, quartiles, and 95% t intervals', () => {
    for (const reference of Object.values(groups)) {
      const result = summaryStatistics(reference.values)
      expect(result.n).toBe(reference.n)
      expect(result.mean).toBeCloseTo(reference.mean, 10)
      expect(result.q1).toBeCloseTo(reference.q1, 10)
      expect(result.median).toBeCloseTo(reference.median, 10)
      expect(result.q3).toBeCloseTo(reference.q3, 10)
      for (const [actual, expected] of [[result.sd, reference.sd], [result.se, reference.se], [result.confidenceInterval, reference.ci]]) {
        if (expected === null) expect(actual).toBeNull()
        else expect(actual).toBeCloseTo(expected, 9)
      }
    }
  })

  it('omits missing responses from a grouped confidence-interval graph', () => {
    const rows: DataRow[] = Object.entries(groups).flatMap(([category, reference]) => reference.values.map((value, index) => ({ id: `${category}${index}`, excluded: false, values: { category, response: value } })))
    rows.push({ id: 'missing', excluded: false, values: { category: 'A', response: null } })
    const layer: GraphLayer = { id: 'mean', name: 'Mean line', element: 'summary' }
    const points = statisticalSeries(rows, 'category', 'response', layer, 'mean', 'ci').points
    expect(points.map((point) => point.n)).toEqual([4, 3, 1])
    expect(points[0].value).toBeCloseTo(groups.A.mean, 10)
    expect(points[0].error?.plus).toBeCloseTo(groups.A.ci, 9)
    expect(points[1].error?.plus).toBeCloseTo(groups.B.ci, 9)
    expect(points[2].error).toBeNull()
  })

  it('matches unconstrained and fixed-intercept linear fits', () => {
    const x = [1, 1, 2, 3, 4, 4, 5]; const y = [2, 3, 4, 8, 8, 10, 9]
    const fit = linearFit(x, y)!
    expect(fit.n).toBe(7)
    expect(fit.slope).toBeCloseTo(1.9038461538461535, 10)
    expect(fit.intercept).toBeCloseTo(0.8461538461538467, 10)
    expect(fit.rSquared).toBeCloseTo(0.8766547406082288, 10)
    const fixed = linearFit(x, y, undefined, 1)!
    expect(fixed.slope).toBeCloseTo(1.8611111111111107, 10)
    expect(fixed.intercept).toBe(1)
    expect(fixed.rSquared).toBeCloseTo(0.8760981912144703, 10)
  })

  it('matches the centered three-value moving average after repeated X values are averaged', () => {
    const trend = smoothedTrend([1, 1, 2, 3, 4, 4, 5], [2, 3, 4, 8, 8, 10, 9], 3)
    expect(trend.x).toEqual([1, 2, 3, 4, 5])
    for (const [index, expected] of [3.25, 4.833333333333333, 7, 8.666666666666666, 9].entries()) expect(trend.y[index]).toBeCloseTo(expected, 10)
  })

  it('matches frequency-expanded observations, histogram counts, and box outliers', () => {
    const weighted = summaryStatistics([4, 9, 12], [1, 3, 2])
    expect(weighted.n).toBe(6)
    expect(weighted.mean).toBeCloseTo(9.166666666666666, 10)
    expect(weighted.sd).toBeCloseTo(2.9268868558020253, 10)
    expect(histogramBins([0, 1, 2, 3, 4], 2)).toMatchObject({ centers: [1, 3], counts: [2, 3] })
    expect(boxSummary([1, 2, 2, 3, 20])).toEqual({ q1: 2, median: 2, q3: 3, lowerWhisker: 1, upperWhisker: 3, outliers: [20] })
  })
})
