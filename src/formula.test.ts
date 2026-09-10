import { describe, expect, it } from 'vitest'
import { calculateColumn, evaluateFormula } from './formula'
import type { DataColumn, DataRow } from './types'

const columns: DataColumn[] = [{ id: 'force_0', name: 'Force', dataType: 'number', modelingType: 'continuous' }, { id: 'area_1', name: 'Area', dataType: 'number', modelingType: 'continuous' }]
const row: DataRow = { id: 'r1', excluded: false, values: { force_0: 12, area_1: 3 } }

describe('restricted formulas', () => {
  it('evaluates arithmetic, functions, and conditionals', () => {
    expect(evaluateFormula('sqrt([Force]) + abs(-2)', row, columns)).toBeCloseTo(Math.sqrt(12) + 2)
    expect(evaluateFormula('if([Force] > 10, max([Area], 4), 0)', row, columns)).toBe(4)
  })
  it('stores stable IDs but accepts friendly names', () => {
    const result = calculateColumn('Stress', '[Force] / [Area]', columns, [row])
    expect(result.column.formula).toBe('[force_0] / [area_1]')
    expect(result.values).toEqual([4])
  })
  it('turns invalid numeric domains into missing warnings', () => {
    const result = calculateColumn('Bad', 'sqrt(-1)', columns, [row])
    expect(result.values).toEqual([null]); expect(result.warnings).toHaveLength(1)
  })
  it('rejects invalid formulas atomically', () => {
    expect(() => calculateColumn('Bad', '[Unknown] +', columns, [row])).toThrow()
  })
})
