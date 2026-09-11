import { describe, expect, it } from 'vitest'
import { errorBarExtent, studentTCritical, summaryStatistics } from './statistics'

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
})
