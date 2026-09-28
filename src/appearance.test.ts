import { describe, expect, it } from 'vitest'
import { axisConfiguration, categoryTickLayout, orderedCategories, palettes } from './appearance'
import type { DataColumn, DataRow, GraphSpec } from './types'

const column: DataColumn = { id: 'group', name: 'Group', dataType: 'text', modelingType: 'nominal' }
const rows: DataRow[] = [
  { id: '1', excluded: false, values: { group: 'B', response: 2 } },
  { id: '2', excluded: false, values: { group: 'A', response: 6 } },
  { id: '3', excluded: false, values: { group: 'B', response: 4 } },
]
const spec = (categoryOrder: GraphSpec['categoryOrder'], manualCategories?: string[]) => ({ categoryOrder, manualCategories }) as GraphSpec

describe('appearance rules', () => {
  it('rejects nonpositive log values and invalid bounds', () => {
    expect(axisConfiguration({ scale: 'log' }, [1, 0, 10], 'number').error).toMatch(/above zero/)
    expect(axisConfiguration({ scale: 'log', forceZero: true }, [1, 10], 'number').error).toMatch(/above zero/)
    expect(axisConfiguration({ min: 5, max: 2 }, [1, 10], 'number').error).toMatch(/less than/)
    expect(axisConfiguration({ tickInterval: 0 }, [1, 10], 'number').error).toMatch(/greater than/)
  })

  it('converts log bounds, reversal, and date ticks for the renderer', () => {
    expect(axisConfiguration({ scale: 'log', min: 1, max: 100, reversed: true }, [1, 100], 'number').axis).toMatchObject({ type: 'log', range: [2, 0] })
    expect(axisConfiguration({ tickInterval: 2 }, ['2026-01-01'], 'date').axis).toMatchObject({ type: 'date', dtick: 172800000 })
  })

  it('orders categories by data, name, mean, or manual choice', () => {
    expect(orderedCategories(rows, column, spec('data'))).toEqual(['B', 'A'])
    expect(orderedCategories(rows, column, spec('alphabetic'))).toEqual(['A', 'B'])
    expect(orderedCategories(rows, column, spec('summary'), [], 'response')).toEqual(['A', 'B'])
    expect(orderedCategories(rows, column, spec('manual', ['A', 'B']))).toEqual(['A', 'B'])
  })

  it('provides an accessible palette with distinct series colors', () => {
    expect(new Set(palettes.colorblind).size).toBe(palettes.colorblind.length)
  })

  it('reserves margin for categorical ticks and angles long labels', () => {
    expect(categoryTickLayout()).toEqual({})
    expect(categoryTickLayout(['A', 'B'])).toEqual({ automargin: true })
    expect(categoryTickLayout(['Extended engineering category label'])).toEqual({ automargin: true, tickangle: -45 })
  })
})
