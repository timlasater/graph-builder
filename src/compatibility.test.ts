import { describe, expect, it } from 'vitest'
import { resolveAssignment, suggestElement, suggestedElement } from './compatibility'
import type { DataColumn, DataRow, GraphSpec } from './types'

const numeric: DataColumn = { id: 'n', name: 'Number', dataType: 'number', modelingType: 'continuous' }
const category: DataColumn = { id: 'c', name: 'Category', dataType: 'text', modelingType: 'nominal' }
const ordinal: DataColumn = { id: 'o', name: 'Order', dataType: 'number', modelingType: 'ordinal' }
const date: DataColumn = { id: 'd', name: 'Date', dataType: 'date', modelingType: 'continuous' }
const spec: GraphSpec = { title: '', subtitle: '', x: ['n'], y: [], layers: [{ id: 'l', name: 'Points', element: 'points' }], activeLayerId: 'l', showGrid: true, markerSize: 9 }
const row = (id: string, values: DataRow['values']): DataRow => ({ id, excluded: false, values })

describe('role compatibility', () => {
  it('adds and reorders multiple axis assignments', () => {
    const added = resolveAssignment(spec, category, 'x').spec
    expect(added.x).toEqual(['n', 'c'])
    expect(resolveAssignment(added, category, 'x', 'x', 0).spec.x).toEqual(['c', 'n'])
  })
  it('rejects nonnumeric weight assignments without mutation', () => {
    const result = resolveAssignment(spec, category, 'weight')
    expect(result.accepted).toBe(false); expect(result.spec).toBe(spec); expect(result.message).toContain('numeric')
  })
  it('resolves wrap and grouping conflicts predictably', () => {
    const grouped = { ...spec, groupX: 'c' }
    expect(resolveAssignment(grouped, category, 'wrap').spec.groupX).toBeUndefined()
  })
  it('replaces singleton assignments predictably', () => {
    const colored = { ...spec, color: 'old' }
    expect(resolveAssignment(colored, category, 'color').spec.color).toBe('c')
  })
  it('suggests bars for nominal categories', () => {
    expect(suggestedElement([category], [numeric])).toBe('bar')
  })
  it('suggests mean lines when X values are replicated', () => {
    expect(suggestElement([numeric], [numeric], [row('1', { n: 10 }), row('2', { n: 10 })]).element).toBe('summary')
  })
  it('suggests lines for ordered or date axes and fits for continuous numeric axes', () => {
    expect(suggestedElement([ordinal], [numeric])).toBe('line')
    expect(suggestedElement([date], [numeric])).toBe('line')
    expect(suggestedElement([numeric], [numeric])).toBe('fit')
  })
})
