import { describe, expect, it } from 'vitest'
import { errorBarExtent, studentTCritical, summaryStatistics, summaryValue, transformSummaryValues, weightedQuantile } from './statistics'

describe('summary statistics', () => {
  it('matches a hand-calculable sample using n - 1 standard deviation', () => {
    const result = summaryStatistics([2, 4, 4, 4, 5, 5, 7, 9])
    expect(result.mean).toBe(5); expect(result.sd).toBeCloseTo(2.138089935, 8); expect(result.se).toBeCloseTo(0.755928946, 8); expect(result.n).toBe(8)
  })
  it('uses the Student t critical value for a two-sided 95% interval', () => {
    expect(studentTCritical(0.95, 1)).toBeCloseTo(12.7062, 3)
    expect(studentTCritical(0.95, 4)).toBeCloseTo(2.77645, 4)
  })
  it('computes selectable two-sided Student t confidence intervals', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9]
    const interval90 = summaryStatistics(values, undefined, 0.9).confidenceInterval
    const interval99 = summaryStatistics(values, undefined, 0.99).confidenceInterval
    expect(interval90).toBeCloseTo(1.432, 3)
    expect(interval99).toBeCloseTo(2.64536, 5)
    expect(interval99!).toBeGreaterThan(interval90!)
  })
  it('returns no uncertainty for a one-observation group', () => {
    expect(summaryStatistics([7])).toMatchObject({ n: 1, mean: 7, sd: null, se: null, confidenceInterval: null })
  })
  it('omits invalid values and supports asymmetric ranges', () => {
    const result = summaryStatistics([2, Number.NaN, 5, 9])
    expect(result.n).toBe(3); expect(errorBarExtent(result, 'range')).toEqual({ plus: 9 - 16 / 3, minus: 16 / 3 - 2 })
  })
  it('omits observations with missing weights', () => {
    expect(summaryStatistics([10, 20, 30], [1, Number.NaN, 1])).toMatchObject({ n: 2, mean: 20 })
  })
  it('uses positive frequency weights in the mean and sample variance', () => {
    const result = summaryStatistics([10, 20], [1, 3])
    expect(result.mean).toBe(17.5); expect(result.sd).toBeCloseTo(5, 10); expect(result.n).toBe(4)
  })
  it('calculates descriptive values against a hand worked eight-value sample', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9]
    const result = summaryStatistics(values)
    expect(result).toMatchObject({ n: 8, sum: 40, mean: 5, median: 4.5, q1: 4, q3: 5.5, minimum: 2, maximum: 9 })
    expect(summaryValue(result, 'count')).toBe(8)
    expect(summaryValue(result, 'quantile', 0.75, values)).toBe(5.5)
    expect(weightedQuantile([10, 20], 0.5, [1, 3])).toBe(20)
  })
  it('matches a four-value reference for every selectable summary measure', () => {
    const values = [1, 2, 3, 4]
    const summary = summaryStatistics(values)
    const expected = { count: 4, sum: 10, mean: 2.5, median: 2.5, min: 1, max: 4, quantile: 3.25, sd: Math.sqrt(5 / 3), se: Math.sqrt(5 / 12) } as const
    for (const [measure, value] of Object.entries(expected)) {
      expect(summaryValue(summary, measure as keyof typeof expected, 0.75, values)).toBeCloseTo(value, 8)
    }
    expect(summary.q1).toBe(1.75)
    expect(summary.q3).toBe(3.25)
  })
  it('matches independent reference widths for each calculated uncertainty type', () => {
    const summary = summaryStatistics([1, 2, 3, 4])
    expect(errorBarExtent(summary, 'sd')).toEqual({ plus: summary.sd!, minus: summary.sd! })
    expect(errorBarExtent(summary, 'se')).toEqual({ plus: summary.se!, minus: summary.se! })
    expect(errorBarExtent(summary, 'range')).toEqual({ plus: 1.5, minus: 1.5 })
    expect(errorBarExtent(summary, 'ci')?.plus).toBeCloseTo(2.05426, 4)
  })
  it('matches NIST StRD NumAcc1 certified mean and sample SD exactly', () => {
    // https://www.itl.nist.gov/div898/strd/univ/data/NumAcc1.dat
    const result = summaryStatistics([10000001, 10000003, 10000002])
    expect(result.mean).toBe(10000002)
    expect(result.sd).toBe(1)
  })
  it('scales values and errors by a fixed positive total or control', () => {
    expect(transformSummaryValues([2, 3, null], ['A', 'B', 'C'], 'percentTotal')).toMatchObject({ values: [40, 60, null], factor: 20 })
    expect(transformSummaryValues([2, 3], ['A', 'B'], 'control', 'A')).toMatchObject({ values: [100, 150], factor: 50 })
    expect(transformSummaryValues([0, 3], ['A', 'B'], 'control', 'A').error).toContain('positive')
  })
})
