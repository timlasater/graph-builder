import { describe, expect, it } from 'vitest'
import { aggregateBars, boxSummary, histogramBins, linearFit, moveOrderedValue, numericOrNaN, orderByPreference, sortedSeries, stableCategoryOrder, stackCompatibility, weightedMean } from './plotTransforms'
import type { DataRow } from './types'

describe('layer transformations', () => {
  it('applies and edits a persistent categorical order', () => {
    expect(orderByPreference(['A', 'B', 'C'], ['C', 'A'])).toEqual(['C', 'A', 'B'])
    expect(orderByPreference(['A', 'B', 'C'], ['C', 'C', 'A'])).toEqual(['C', 'A', 'B'])
    expect(moveOrderedValue(['A', 'B', 'C'], 'C', 'A')).toEqual(['C', 'A', 'B'])
    expect(moveOrderedValue(['A', 'B'], 'missing', 'A')).toEqual(['A', 'B'])
  })
  it('computes weighted summaries', () => expect(weightedMean([10, 20], [1, 3])).toBe(17.5))
  it('computes a linear fit', () => expect(linearFit([1, 2, 3], [2, 4, 6])).toMatchObject({ x: [1, 3], y: [2, 6], slope: 2, intercept: 0 }))
  it('does not fit degenerate inputs', () => expect(linearFit([1, 1], [2, 3])).toBeNull())
  it('does not turn missing regression values into zeroes', () => {
    expect(numericOrNaN(null)).toBeNaN()
    expect(linearFit([1, numericOrNaN(null), 3], [2, 100, 6])).toMatchObject({ slope: 2, intercept: 0 })
  })
  it('applies frequency weights to fits, histograms, and bar summaries', () => {
    expect(linearFit([1, 2, 3], [1, 10, 3], [1, 0, 1])).toMatchObject({ slope: 1, intercept: 0 })
    expect(histogramBins([0, 1], 2, undefined, [2, 3]).counts).toEqual([2, 3])
    expect(aggregateBars(['A', 'A'], [10, 20], 'mean', [1, 3])[0]).toEqual({ key: 'A', value: 17.5, n: 4 })
    expect(aggregateBars(['A', 'A'], [10, 20], 'count', [1, 3])[0].value).toBe(4)
  })
  it('bins numeric observations without dropping the maximum', () => expect(histogramBins([0, 1, 2, 3, 4], 2)).toEqual({ centers: [1, 3], counts: [2, 3], width: 2 }))
  it('uses a supplied shared histogram domain', () => expect(histogramBins([2, 3], 2, [0, 4])).toEqual({ centers: [1, 3], counts: [0, 2], width: 2 }))
  it('aggregates bars by mean, sum, or count', () => {
    expect(aggregateBars(['A', 'A', 'B'], [2, 4, 9], 'mean')).toEqual([{ key: 'A', value: 3, n: 2 }, { key: 'B', value: 9, n: 1 }])
    expect(aggregateBars(['A', 'A'], [2, 4], 'sum')[0].value).toBe(6); expect(aggregateBars(['A', 'A'], [2, 4], 'count')[0].value).toBe(2)
  })
  it('uses Tukey 1.5 IQR fences for box-plot outliers', () => expect(boxSummary([1, 2, 2, 3, 20])).toMatchObject({ q1: 2, median: 2, q3: 3, lowerWhisker: 1, upperWhisker: 3, outliers: [20] }))
  it('orders line and area series by X', () => expect(sortedSeries([3, 1, 2], [30, 10, 20]).map((point) => point.x)).toEqual([1, 2, 3]))
  it('rejects stacks whose series do not share X values', () => {
    const rows: DataRow[] = [{ id: '1', excluded: false, values: { x: 1, g: 'A' } }, { id: '2', excluded: false, values: { x: 2, g: 'A' } }, { id: '3', excluded: false, values: { x: 1, g: 'B' } }]
    expect(stackCompatibility(rows, 'x', 'g')).toMatchObject({ compatible: false })
    expect(stackCompatibility([...rows, { id: '4', excluded: false, values: { x: 2, g: 'B' } }], 'x', 'g')).toEqual({ compatible: true })
  })
  it('uses false then true for boolean categories regardless of encounter order', () => {
    expect(stableCategoryOrder([true, false, true], { id: 'passed', name: 'Passed', dataType: 'boolean', modelingType: 'nominal' })).toEqual([false, true])
  })
  it('sorts ordinal categories naturally and applies value labels', () => {
    expect(stableCategoryOrder(['10', '2', '1'], { id: 'rank', name: 'Rank', dataType: 'text', modelingType: 'ordinal', valueLabels: { '1': 'Low', '2': 'Medium', '10': 'High' } })).toEqual(['Low', 'Medium', 'High'])
  })
})
