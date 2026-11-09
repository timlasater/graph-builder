import { describe, expect, it } from 'vitest'
import { compareCategories } from './comparisons'
import { datasetFromMatrix } from './importData'

describe('two-category comparisons', () => {
  it('calculates a two-sided Welch test and confidence interval', () => {
    const dataset = datasetFromMatrix([['Group', 'Value'], ['A', 1], ['A', 2], ['A', 3], ['B', 4], ['B', 5], ['B', 6]], 'Welch')
    const [x, y] = dataset.columns
    const output = compareCategories(dataset.rows, x, y, { method: 'welch', categoryA: 'A', categoryB: 'B', confidenceLevel: 0.95 })
    expect(output.result?.difference).toBe(3)
    expect(output.result?.degreesOfFreedom).toBeCloseTo(4, 6)
    expect(output.result?.pValue).toBeCloseTo(0.021311641, 6)
    expect(output.result?.lower).toBeCloseTo(0.733, 2)
  })

  it('matches complete subjects and omits ambiguous repeated pairs', () => {
    const dataset = datasetFromMatrix([
      ['Subject', 'Visit', 'Value'], ['A', 'Before', 1], ['B', 'Before', 2], ['C', 'Before', 3],
      ['C', 'After', 7], ['A', 'After', 3], ['B', 'After', 5], ['D', 'Before', 8], ['D', 'Before', 9], ['D', 'After', 11],
    ], 'Paired')
    const [id, x, y] = dataset.columns
    const output = compareCategories(dataset.rows, x, y, { method: 'paired', categoryA: 'Before', categoryB: 'After', pairId: id.id, confidenceLevel: 0.95 }, id)
    expect(output.result?.difference).toBe(3)
    expect(output.result?.nA).toBe(3)
    expect(output.result?.pValue).toBeCloseTo(0.0350987186, 6)
    expect(output.result?.notes[0]).toContain('repeated')
  })
})
