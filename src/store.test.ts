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
  it('matches date ranges and missing-value filters', () => {
    const row = { ...sampleDataset.rows[0], values: { ...sampleDataset.rows[0].values, run: '2026-09-25T12:00:00Z', passed: null } }
    expect(rowMatchesFilters(row, [{ id: 'date', columnId: 'run', operator: 'dateBetween', start: '2026-09-25T00:00', end: '2026-09-25T23:59' }])).toBe(true)
    expect(rowMatchesFilters(row, [{ id: 'missing', columnId: 'passed', operator: 'isMissing' }])).toBe(true)
    expect(rowMatchesFilters(row, [{ id: 'present', columnId: 'dose', operator: 'isNotMissing' }])).toBe(true)
  })
  it('keeps linked row selection separate from undoable graph history', () => {
    const ids = sampleDataset.rows.slice(0, 2).map((row) => row.id)
    useBuilderStore.getState().setSelectedRowIds(ids)
    expect(useBuilderStore.getState().selectedRowIds).toEqual(ids)
    useBuilderStore.getState().updateSpec({ title: 'Linked selection' })
    useBuilderStore.getState().clearRowSelection()
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().selectedRowIds).toEqual([])
    expect(useBuilderStore.getState().spec.title).not.toBe('Linked selection')
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

  it('adds and configures a Phase 4 layer through undoable store actions', () => {
    useBuilderStore.getState().addLayer('histogram')
    const layer = useBuilderStore.getState().spec.layers.at(-1)!
    useBuilderStore.getState().updateLayer(layer.id, { binCount: 12 })
    expect(useBuilderStore.getState().spec.layers.at(-1)).toMatchObject({ element: 'histogram', binCount: 12 })
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.layers.at(-1)?.binCount).toBeUndefined()
  })

  it('stores and undoes Phase 5 mean-layer confidence and observation settings', () => {
    useBuilderStore.getState().addLayer('summary')
    const layer = useBuilderStore.getState().spec.layers.at(-1)!
    expect(layer).toMatchObject({ errorBar: 'sd', confidenceLevel: 0.95, showObservations: false })
    useBuilderStore.getState().updateLayer(layer.id, { errorBar: 'ci', confidenceLevel: 0.99, showObservations: true })
    expect(useBuilderStore.getState().spec.layers.at(-1)).toMatchObject({ errorBar: 'ci', confidenceLevel: 0.99, showObservations: true })
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.layers.at(-1)).toMatchObject({ errorBar: 'sd', confidenceLevel: 0.95, showObservations: false })
  })

  it('stores and undoes interactive legend order, colors, and visibility', () => {
    useBuilderStore.getState().updateSpec({ legendOrder: ['series-b', 'series-a'], seriesColors: { 'series-b': '#ff0000' }, hiddenSeries: ['series-a'] })
    expect(useBuilderStore.getState().spec).toMatchObject({ legendOrder: ['series-b', 'series-a'], seriesColors: { 'series-b': '#ff0000' }, hiddenSeries: ['series-a'] })
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.legendOrder).toBeUndefined()
    expect(useBuilderStore.getState().spec.seriesColors).toBeUndefined()
    expect(useBuilderStore.getState().spec.hiddenSeries).toBeUndefined()
  })

  it('loads and undoes a saved plot setup atomically', () => {
    const original = structuredClone(useBuilderStore.getState().spec)
    const saved = { ...original, title: 'Saved setup', x: ['run'], y: ['dose'] }
    const filters = [{ id: 'saved-filter', columnId: 'prototype', operator: 'equals' as const, value: 'Prototype B' }]
    useBuilderStore.getState().applyPlotSetup(saved, filters)
    expect(useBuilderStore.getState().spec.title).toBe('Saved setup')
    expect(useBuilderStore.getState().filters).toEqual(filters)
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec).toEqual(original)
    expect(useBuilderStore.getState().filters).toEqual([])
  })

  it('loads refreshed source rows and a saved plot setup in one undoable action', () => {
    const originalRows = useBuilderStore.getState().dataset.rows.length
    const saved = { ...useBuilderStore.getState().spec, title: 'Latest results' }
    const refreshed = { ...sampleDataset, rows: [...sampleDataset.rows, { id: 'new-row', excluded: false, values: { ...sampleDataset.rows[0].values } }], source: { fileName: 'results.xlsx', sheetName: 'Results', handleId: 'handle-1' } }
    useBuilderStore.getState().applyPlotSetup(saved, [], refreshed)
    expect(useBuilderStore.getState().dataset.rows).toHaveLength(originalRows + 1)
    expect(useBuilderStore.getState().dataset.source?.handleId).toBe('handle-1')
    expect(useBuilderStore.getState().spec.title).toBe('Latest results')
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().dataset.rows).toHaveLength(originalRows)
  })

  it('recalculates formula columns after source edits and appended rows', () => {
    useBuilderStore.getState().addCalculatedColumn('Dose ratio', '[dose] / [pressure]')
    const calculated = useBuilderStore.getState().dataset.columns.at(-1)!
    const firstRow = useBuilderStore.getState().dataset.rows[0]

    useBuilderStore.getState().updateCell(firstRow.id, 'dose', 100)
    expect(useBuilderStore.getState().dataset.rows[0].values[calculated.id]).toBe(5)

    useBuilderStore.getState().appendRows([['Prototype D', 25, 50, 99, true]])
    expect(useBuilderStore.getState().dataset.rows.at(-1)?.values[calculated.id]).toBe(2)
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
