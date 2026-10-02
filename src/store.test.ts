import { beforeEach, describe, expect, it } from 'vitest'
import { hasUnsavedProjectChanges, moveRoleAssignment, projectFingerprint, projectGraphs, rowMatchesFilters, useBuilderStore } from './store'
import { sampleDataset } from './sampleData'

describe('graph history', () => {
  beforeEach(() => {
    useBuilderStore.getState().reset()
  })

  it('recognizes saved projects, edits, and undo back to the saved contents', () => {
    const store = useBuilderStore.getState()
    expect(hasUnsavedProjectChanges(store)).toBe(false)
    store.markProjectSaved(projectFingerprint(store))
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(false)
    store.updateSpec({ title: 'Edited title' })
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(true)
    store.undo()
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(false)
    store.redo()
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(true)
  })

  it('treats the untouched example as ready to replace without saving', () => {
    const store = useBuilderStore.getState()
    expect(hasUnsavedProjectChanges(store)).toBe(false)
    store.updateSpec({ title: 'Changed example' })
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(true)
    store.reset()
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(false)
  })

  it('keeps the opened project data mode and resets it for new data', () => {
    const store = useBuilderStore.getState()
    store.openProject('Linked study', sampleDataset, projectGraphs(store), store.activeGraphId, undefined, 'linked')
    expect(useBuilderStore.getState().projectMode).toBe('linked')
    store.setDataset(sampleDataset)
    expect(useBuilderStore.getState().projectMode).toBe('embedded')
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

  it('undoes and redoes opening a different project with its data and graphs', () => {
    const store = useBuilderStore.getState()
    store.renameProject('My work')
    store.setProjectPath('C:\\Studies\\my-work.graphbuilder')
    store.updateCell(sampleDataset.rows[0].id, 'dose', 777)
    store.newGraph()
    const original = {
      name: useBuilderStore.getState().projectName,
      path: useBuilderStore.getState().projectPath,
      dataset: structuredClone(useBuilderStore.getState().dataset),
      graphs: structuredClone(projectGraphs(useBuilderStore.getState())),
    }
    const incomingDataset = { ...sampleDataset, name: 'Another project', rows: sampleDataset.rows.slice(0, 2) }
    const incomingGraphs = [{ id: 'incoming', name: 'New graph', spec: { ...store.spec, title: 'New graph' }, filters: [] }]

    store.openProject('Another project', incomingDataset, incomingGraphs, 'incoming', 'C:\\Studies\\another.graphbuilder')
    expect(useBuilderStore.getState().dataset.rows).toHaveLength(2)
    expect(useBuilderStore.getState().projectName).toBe('Another project')
    expect(useBuilderStore.getState().projectPath).toBe('C:\\Studies\\another.graphbuilder')
    store.undo()
    expect(useBuilderStore.getState().projectName).toBe(original.name)
    expect(useBuilderStore.getState().projectPath).toBe(original.path)
    expect(useBuilderStore.getState().dataset).toEqual(original.dataset)
    expect(projectGraphs(useBuilderStore.getState())).toEqual(original.graphs)
    store.redo()
    expect(useBuilderStore.getState().projectName).toBe('Another project')
    expect(useBuilderStore.getState().projectPath).toBe('C:\\Studies\\another.graphbuilder')
    expect(useBuilderStore.getState().dataset.rows).toHaveLength(2)
  })

  it('undoes a visual theme and axis change together', () => {
    useBuilderStore.getState().updateSpec({ theme: 'dark', yAxis: { scale: 'log' }, graphWidth: 900 })
    expect(useBuilderStore.getState().spec.yAxis?.scale).toBe('log')
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.theme).toBeUndefined()
    expect(useBuilderStore.getState().spec.graphWidth).toBeUndefined()
  })

  it('keeps separate named graphs and reopens each with its own settings', () => {
    const store = useBuilderStore.getState()
    store.renameProject('Study')
    store.renameGraph('Dose')
    store.updateSpec({ title: 'Dose view' })
    store.newGraph()
    const secondId = useBuilderStore.getState().activeGraphId
    expect(useBuilderStore.getState().spec.x).toEqual([])
    expect(useBuilderStore.getState().spec.y).toEqual([])
    expect(useBuilderStore.getState().spec.layers).toHaveLength(1)
    expect(useBuilderStore.getState().dataset).toEqual(sampleDataset)
    store.renameGraph('Pressure')
    store.updateSpec({ title: 'Pressure view' })
    const first = projectGraphs(useBuilderStore.getState()).find((graph) => graph.name === 'Dose')!
    store.openGraph(first.id)
    expect(useBuilderStore.getState().spec.title).toBe('Dose view')
    store.openGraph(secondId)
    expect(useBuilderStore.getState().spec.title).toBe('Pressure view')
    expect(useBuilderStore.getState().projectName).toBe('Study')
    store.duplicateGraph()
    expect(projectGraphs(useBuilderStore.getState())).toHaveLength(3)
    expect(useBuilderStore.getState().activeGraphName).toBe('Pressure view')
  })

  it('defaults graph names to titles and follows title edits until manually renamed', () => {
    const store = useBuilderStore.getState()
    expect(store.activeGraphName).toBe(store.spec.title)
    store.updateSpec({ title: 'Dose response' })
    expect(useBuilderStore.getState().activeGraphName).toBe('Dose response')
    store.renameGraph('My selected view')
    store.updateSpec({ title: 'Revised response' })
    expect(useBuilderStore.getState().activeGraphName).toBe('My selected view')
    store.newGraph()
    expect(useBuilderStore.getState().activeGraphName).toBe(useBuilderStore.getState().spec.title)
    store.duplicateGraph()
    expect(useBuilderStore.getState().activeGraphName).toBe(useBuilderStore.getState().spec.title)
  })

  it('deletes active and inactive graphs, supports undo, and keeps the last graph', () => {
    const store = useBuilderStore.getState()
    const firstId = store.activeGraphId
    store.renameGraph('First')
    store.newGraph()
    const secondId = useBuilderStore.getState().activeGraphId
    store.renameGraph('Second')
    store.updateSpec({ title: 'Second chart' })
    store.deleteGraph(firstId)
    expect(projectGraphs(useBuilderStore.getState()).map((graph) => graph.id)).toEqual([secondId])
    store.undo()
    expect(projectGraphs(useBuilderStore.getState())).toHaveLength(2)
    store.deleteGraph(secondId)
    expect(useBuilderStore.getState().activeGraphId).toBe(firstId)
    expect(useBuilderStore.getState().activeGraphName).toBe('First')
    expect(projectGraphs(useBuilderStore.getState())).toHaveLength(1)
    store.deleteGraph(firstId)
    store.deleteGraph('missing')
    expect(projectGraphs(useBuilderStore.getState())).toHaveLength(1)
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
  it('can undo a new data import without losing the earlier project', () => {
    const original = useBuilderStore.getState().dataset
    useBuilderStore.getState().setDataset({ ...sampleDataset, name: 'Imported study', rows: sampleDataset.rows.slice(0, 1) })
    expect(useBuilderStore.getState().dataset.rows).toHaveLength(1)
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().dataset).toEqual(original)
  })
  it('matches explicit persistent filters', () => {
    expect(rowMatchesFilters(sampleDataset.rows[0], [{ id: 'f', columnId: 'prototype', operator: 'contains', value: 'A' }])).toBe(true)
    expect(rowMatchesFilters(sampleDataset.rows[0], [{ id: 'f', columnId: 'pressure', operator: 'gt', value: 100 }])).toBe(false)
    expect(rowMatchesFilters(sampleDataset.rows[0], [{ id: 'f', columnId: 'prototype', operator: 'in', values: ['Group A'] }])).toBe(true)
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

  it('loads and undoes a graph template atomically', () => {
    const original = structuredClone(useBuilderStore.getState().spec)
    const saved = { ...original, title: 'Saved setup', x: ['run'], y: ['dose'] }
    const filters = [{ id: 'saved-filter', columnId: 'prototype', operator: 'equals' as const, value: 'Group B' }]
    useBuilderStore.getState().applyGraphTemplate(saved, filters)
    expect(useBuilderStore.getState().spec.title).toBe('Saved setup')
    expect(useBuilderStore.getState().filters).toEqual(filters)
    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec).toEqual(original)
    expect(useBuilderStore.getState().filters).toEqual([])
  })

  it('loads refreshed source rows and graph settings in one undoable action', () => {
    const originalRows = useBuilderStore.getState().dataset.rows.length
    const saved = { ...useBuilderStore.getState().spec, title: 'Latest results' }
    const refreshed = { ...sampleDataset, rows: [...sampleDataset.rows, { id: 'new-row', excluded: false, values: { ...sampleDataset.rows[0].values } }], source: { fileName: 'results.xlsx', sheetName: 'Results', handleId: 'handle-1' } }
    useBuilderStore.getState().applyGraphTemplate(saved, [], refreshed)
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
