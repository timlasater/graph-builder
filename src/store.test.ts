import { beforeEach, describe, expect, it } from 'vitest'
import { moveRoleAssignment, rowMatchesFilters, useBuilderStore } from './store'
import { sampleDataset } from './sampleData'

describe('graph history', () => {
  beforeEach(() => {
    useBuilderStore.getState().reset()
  })

  it('restores an earlier graph element with undo and redo', () => {
    const original = useBuilderStore.getState().spec.layers[0].element

    useBuilderStore.getState().setElement(original === 'points' ? 'line' : 'points')
    const changed = useBuilderStore.getState().spec.layers[0].element
    expect(changed).not.toBe(original)

    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.layers[0].element).toBe(original)

    useBuilderStore.getState().redo()
    expect(useBuilderStore.getState().spec.layers[0].element).toBe(changed)
  })
})

describe('data history and filters', () => {
  beforeEach(() => useBuilderStore.getState().reset())
  it('undoes a complete dataset edit', () => {
    const row = sampleDataset.rows[0]; const original = row.values.dose
    useBuilderStore.getState().updateCell(row.id, 'dose', 999)
    expect(useBuilderStore.getState().dataset.rows[0].values.dose).toBe(999)
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().dataset.rows[0].values.dose).toBe(original)
  })
  it('matches explicit persistent filters', () => {
    expect(rowMatchesFilters(sampleDataset.rows[0], [{ id: 'f', columnId: 'prototype', operator: 'contains', value: 'A' }])).toBe(true)
    expect(rowMatchesFilters(sampleDataset.rows[0], [{ id: 'f', columnId: 'pressure', operator: 'gt', value: 100 }])).toBe(false)
    expect(rowMatchesFilters(sampleDataset.rows[0], [{ id: 'f', columnId: 'prototype', operator: 'in', values: ['Prototype A'] }])).toBe(true)
    expect(rowMatchesFilters(sampleDataset.rows[0], [{ id: 'f', columnId: 'pressure', operator: 'between', min: 10, max: 25 }])).toBe(true)
  })
  it('undoes a bulk exclusion in one step', () => {
    const ids = sampleDataset.rows.slice(0, 3).map((row) => row.id)
    useBuilderStore.getState().setRowsExcluded(ids, true)
    expect(useBuilderStore.getState().dataset.rows.slice(0, 3).every((row) => row.excluded)).toBe(true)
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().dataset.rows.slice(0, 3).every((row) => !row.excluded)).toBe(true)
  })

  it('undoes layer additions and axis swaps atomically', () => {
    useBuilderStore.getState().addLayer('fit')
    expect(useBuilderStore.getState().spec.layers).toHaveLength(2)
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.layers).toHaveLength(1)
    const before = structuredClone(useBuilderStore.getState().spec)
    useBuilderStore.getState().swapAxes()
    expect(useBuilderStore.getState().spec.x).toEqual(before.y)
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.x).toEqual(before.x)
  })

  it('preserves role assignments when an element changes', () => {
    const before = structuredClone(useBuilderStore.getState().spec)
    useBuilderStore.getState().setElement('bar')
    const after = useBuilderStore.getState().spec
    expect(after.x).toEqual(before.x); expect(after.y).toEqual(before.y); expect(after.color).toBe(before.color)
    expect(after.layers[0].element).toBe('bar')
  })
})

describe('role assignment moves', () => {
  it('removes Wrap when assigning Group X', () => {
    const spec = { ...useBuilderStore.getState().spec, wrap: 'prototype' }
    const moved = moveRoleAssignment(spec, 'passed', 'groupX')

    expect(moved.groupX).toBe('passed')
    expect(moved.wrap).toBeUndefined()
  })

  it('removes both group roles when assigning Wrap', () => {
    const spec = { ...useBuilderStore.getState().spec, groupX: 'passed', groupY: 'prototype' }
    const moved = moveRoleAssignment(spec, 'run', 'wrap')

    expect(moved.wrap).toBe('run')
    expect(moved.groupX).toBeUndefined()
    expect(moved.groupY).toBeUndefined()
  })

  it('moves an assigned variable instead of copying it', () => {
    const spec = { ...useBuilderStore.getState().spec, overlay: 'run' }
    const moved = moveRoleAssignment(spec, 'run', 'color', 'overlay')

    expect(moved.color).toBe('run')
    expect(moved.overlay).toBeUndefined()
  })

  it('unassigns a variable dropped back on the Variables panel', () => {
    const spec = { ...useBuilderStore.getState().spec, size: 'pressure' }
    const moved = moveRoleAssignment(spec, 'pressure', undefined, 'size')

    expect(moved.size).toBeUndefined()
  })
})
