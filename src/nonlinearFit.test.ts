import { describe, expect, it } from 'vitest'
import { nonlinearFit } from './nonlinearFit'

describe('nonlinear fitting', () => {
  it('recovers a four-parameter dose–response curve', () => {
    const x = [0.25, 0.5, 1, 2, 4, 8, 16, 32]
    const y = x.map((dose) => 2 + 8 / (1 + (4 / dose) ** 1.5))
    const outcome = nonlinearFit(x, y, 'doseResponse')
    expect(outcome.error).toBeUndefined()
    expect(outcome.fit!.parameters.map((parameter) => parameter.value)).toEqual([
      expect.closeTo(2, 2), expect.closeTo(10, 2), expect.closeTo(4, 2), expect.closeTo(1.5, 2),
    ])
    expect(outcome.fit!.rSquared).toBeGreaterThan(0.9999)
    expect(outcome.fit!.residuals).toHaveLength(x.length)
  })

  it('recovers exponential decay and reports residuals at source X values', () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7]
    const y = x.map((time) => 3 + 12 * Math.exp(-0.4 * time))
    const outcome = nonlinearFit(x, y, 'exponentialDecay')
    expect(outcome.error).toBeUndefined()
    expect(outcome.fit!.parameters.map((parameter) => parameter.value)).toEqual([
      expect.closeTo(3, 2), expect.closeTo(12, 2), expect.closeTo(0.4, 2),
    ])
    expect(outcome.fit!.residuals.map((point) => point.x)).toEqual(x)
    expect(outcome.fit!.parameters[0].lower).not.toBeNull()
  })
})
