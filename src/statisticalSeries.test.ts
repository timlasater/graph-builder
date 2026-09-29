import { describe, expect, it } from 'vitest'
import { statisticalSeries } from './statisticalSeries'
import type { DataRow, GraphLayer } from './types'

const row = (id: string, x: string, y: number | null, error?: number | null, n?: number | null): DataRow => ({ id, excluded: false, values: { x, y, error: error ?? null, n: n ?? null } })
const layer: GraphLayer = { id: 'summary', name: 'Summary', element: 'summary' }

describe('statistical series', () => {
  it('omits missing responses and handles unequal sample sizes', () => {
    const result = statisticalSeries([row('1', 'A', 2), row('2', 'A', 4), row('3', 'A', null), row('4', 'B', 8)], 'x', 'y', layer, 'mean', 'sd')
    expect(result.points.map((point) => [point.value, point.n])).toEqual([[3, 2], [8, 1]])
    expect(result.points[0].error?.plus).toBeCloseTo(Math.SQRT2)
    expect(result.points[1].error).toBeNull()
    expect(result.warnings.join(' ')).toContain('fewer than two')
  })
  it('uses supplied means and uncertainty without constructing observations', () => {
    const supplied = { ...layer, summaryInput: 'precomputed' as const, precomputedErrorColumn: 'error', precomputedNColumn: 'n' }
    const result = statisticalSeries([row('1', 'A', 12, 2, 3), row('2', 'B', 20, 4, 8)], 'x', 'y', supplied, 'mean', 'sd')
    expect(result.points).toMatchObject([{ value: 12, n: 3, rowIds: ['1'], error: { plus: 2, minus: 2 } }, { value: 20, n: 8, rowIds: ['2'], error: { plus: 4, minus: 4 } }])
  })
  it('warns instead of inventing absent precomputed errors', () => {
    const result = statisticalSeries([row('1', 'A', 12, null, 1)], 'x', 'y', { ...layer, summaryInput: 'precomputed', precomputedErrorColumn: 'error', precomputedNColumn: 'n' }, 'mean', 'ci')
    expect(result.points[0].error).toBeNull()
    expect(result.warnings.join(' ')).toContain('Missing or invalid uncertainty')
  })
  it('uses supplied lower and upper bounds for range bars', () => {
    const source = [{ id: '1', excluded: false, values: { x: 'A', y: 10, low: 8, high: 13 } }]
    const result = statisticalSeries(source, 'x', 'y', { ...layer, summaryInput: 'precomputed', precomputedLowerColumn: 'low', precomputedUpperColumn: 'high' }, 'mean', 'range')
    expect(result.points[0].error).toEqual({ plus: 3, minus: 2 })
  })
})
