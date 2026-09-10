import { describe, expect, it } from 'vitest'
import { linearFit, stableCategoryOrder, weightedMean } from './plotTransforms'

describe('layer transformations', () => {
  it('computes weighted summaries', () => expect(weightedMean([10, 20], [1, 3])).toBe(17.5))
  it('computes a linear fit', () => expect(linearFit([1, 2, 3], [2, 4, 6])).toMatchObject({ x: [1, 3], y: [2, 6], slope: 2, intercept: 0 }))
  it('does not fit degenerate inputs', () => expect(linearFit([1, 1], [2, 3])).toBeNull())
  it('uses false then true for boolean categories regardless of encounter order', () => {
    expect(stableCategoryOrder([true, false, true], { id: 'passed', name: 'Passed', dataType: 'boolean', modelingType: 'nominal' })).toEqual([false, true])
  })
  it('sorts ordinal categories naturally and applies value labels', () => {
    expect(stableCategoryOrder(['10', '2', '1'], { id: 'rank', name: 'Rank', dataType: 'text', modelingType: 'ordinal', valueLabels: { '1': 'Low', '2': 'Medium', '10': 'High' } })).toEqual(['Low', 'Medium', 'High'])
  })
})
