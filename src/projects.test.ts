import { describe, expect, it } from 'vitest'
import { sampleDataset } from './sampleData'
import { projectGraphs, useBuilderStore } from './store'
import { makeProject, parseProject, projectJson, rebuildLinkedDataset } from './projects'

const graph = () => ({ id: 'one', name: 'Dose chart', spec: structuredClone(useBuilderStore.getState().spec), filters: [] })

describe('project files', () => {
  it('round-trips an embedded project with rows, formulas, and graphs', () => {
    const dataset = structuredClone(sampleDataset)
    dataset.columns.push({ id: 'doubled', name: 'Doubled dose', dataType: 'number', modelingType: 'continuous', formula: '[dose] * 2' })
    dataset.rows.forEach((row) => { row.values.doubled = Number(row.values.dose) * 2 })
    const savedGraph = graph()
    savedGraph.spec.panels = [{ id: 'panel-1', title: 'Dose panel', x: 'pressure', y: 'dose', xAxisTitle: 'Pressure input', yAxisTitle: 'Dose output' }]
    savedGraph.spec.xAxis = { title: 'Shared pressure' }
    savedGraph.spec.yAxis = { title: 'Shared dose' }
    savedGraph.spec.xDisplay = 'subplots'
    savedGraph.spec.yDisplay = 'collate'
    savedGraph.spec.subplotColumns = 2
    const project = makeProject('Engineering results', dataset, [savedGraph], 'one', 'embedded')
    expect(parseProject(projectJson(project))).toEqual(project)
    expect(parseProject(projectJson(project)).graphs[0].spec.panels?.[0].xAxisTitle).toBe('Pressure input')
    expect(parseProject(projectJson(project)).graphs[0].spec).toMatchObject({ xDisplay: 'subplots', yDisplay: 'collate', subplotColumns: 2 })
    expect(project.data.mode === 'embedded' && project.data.dataset.rows[0].values.doubled).toBe(Number(dataset.rows[0].values.dose) * 2)
  })

  it('keeps precomputed summary settings and checks referenced columns', () => {
    const savedGraph = graph()
    savedGraph.spec.layers = [{ id: 'supplied', name: 'Supplied', element: 'summary', summaryInput: 'precomputed', precomputedErrorColumn: 'dose', precomputedNColumn: 'pressure', valueTransform: 'control', controlCategory: 'Group A', showSampleSize: true }]
    savedGraph.spec.activeLayerId = 'supplied'
    const project = makeProject('Supplied study', structuredClone(sampleDataset), [savedGraph], 'one', 'embedded')
    expect(parseProject(projectJson(project)).graphs[0].spec.layers[0]).toMatchObject({ summaryInput: 'precomputed', precomputedErrorColumn: 'dose', valueTransform: 'control' })
    savedGraph.spec.layers[0].precomputedErrorColumn = 'missing-column'
    expect(() => parseProject(projectJson(makeProject('Supplied study', structuredClone(sampleDataset), [savedGraph], 'one', 'embedded')))).toThrow('missing column')
  })

  it('reopens an embedded project with edited cells, formulas, filters, and appearance', () => {
    const store = useBuilderStore.getState()
    store.reset()
    store.updateCell(sampleDataset.rows[0].id, 'dose', 91)
    store.addCalculatedColumn('Double dose', '[dose] * 2')
    store.setFilters([{ id: 'only-a', columnId: 'prototype', operator: 'equals', value: 'Group A' }])
    store.updateSpec({ theme: 'dark', graphWidth: 900 })
    const state = useBuilderStore.getState()
    const project = parseProject(projectJson(makeProject('Study', state.dataset, projectGraphs(state), state.activeGraphId, 'embedded')))
    store.reset()
    if (project.data.mode !== 'embedded') throw new Error('Expected embedded data')
    store.openProject(project.name, project.data.dataset, project.graphs, project.activeGraphId)
    expect(useBuilderStore.getState().dataset.rows[0].values.dose).toBe(91)
    expect(useBuilderStore.getState().dataset.columns.some((column) => column.formula)).toBe(true)
    expect(useBuilderStore.getState().filters[0].value).toBe('Group A')
    expect(useBuilderStore.getState().spec.theme).toBe('dark')
    expect(useBuilderStore.getState().spec.graphWidth).toBe(900)
    store.reset()
  })

  it('makes linked files without embedding row data', () => {
    const dataset = { ...sampleDataset, source: { fileName: 'results.csv' } }
    const project = makeProject('Linked', dataset, [graph()], 'one', 'linked')
    expect(project.data).toEqual({ mode: 'linked', source: { fileName: 'results.csv', signature: expect.any(String) }, columns: sampleDataset.columns })
    expect(projectJson(project)).not.toContain('Group A')
  })

  it('saves the desktop source path only in linked projects', () => {
    const dataset = { ...sampleDataset, source: { fileName: 'results.csv', nativePath: 'C:\\Studies\\results.csv' } }
    const linked = parseProject(projectJson(makeProject('Linked', dataset, [graph()], 'one', 'linked')))
    expect(linked.data.mode === 'linked' && linked.data.source.nativePath).toBe(dataset.source.nativePath)
    const embedded = parseProject(projectJson(makeProject('Embedded', dataset, [graph()], 'one', 'embedded')))
    expect(embedded.data.mode === 'embedded' && embedded.data.dataset.source?.nativePath).toBeUndefined()
  })

  it('remembers skipped import rows in linked projects', () => {
    const dataset = { ...sampleDataset, source: { fileName: 'results.csv', skipRows: 2 } }
    const linked = parseProject(projectJson(makeProject('Linked', dataset, [graph()], 'one', 'linked')))
    expect(linked.data.mode === 'linked' && linked.data.source.skipRows).toBe(2)
  })

  it('reapplies linked column settings and recalculates formulas on fresh source rows', () => {
    const columns = [...sampleDataset.columns.map((column) => column.id === 'dose' ? { ...column, name: 'Dose result' } : column), { id: 'double_dose', name: 'Double dose', dataType: 'number' as const, modelingType: 'continuous' as const, formula: '[dose] * 2' }]
    const fresh = { ...sampleDataset, rows: sampleDataset.rows.map((row) => ({ ...row, values: { ...row.values, dose: Number(row.values.dose) + 10 } })) }
    const rebuilt = rebuildLinkedDataset(fresh, columns)
    expect(rebuilt.columns.find((column) => column.id === 'dose')?.name).toBe('Dose result')
    expect(rebuilt.rows[0].values.double_dose).toBe(Number(fresh.rows[0].values.dose) * 2)
  })

  it('migrates version zero flat projects', () => {
    const legacy = { format: 'graphbuilder-project', version: 0, name: 'Old', dataset: sampleDataset, spec: graph().spec, filters: [] }
    const migrated = parseProject(JSON.stringify(legacy))
    expect(migrated.version).toBe(1)
    expect(migrated.graphs[0].name).toBe(graph().spec.title)
  })

  it('rejects corrupt, incompatible, or incomplete files', () => {
    expect(() => parseProject('{')).toThrow('not valid JSON')
    expect(() => parseProject(JSON.stringify({ format: 'graphbuilder-project', version: 99 }))).toThrow('unsupported version')
    const project = makeProject('Good', sampleDataset, [graph()], 'one', 'embedded')
    project.graphs[0].spec.layers = []
    expect(() => parseProject(projectJson(project))).toThrow('incomplete or damaged')
    const malformedFilter = makeProject('Good', sampleDataset, [graph()], 'one', 'embedded')
    malformedFilter.graphs[0].filters = [{ id: 'bad', columnId: 'prototype', operator: 'in', values: 'Group A' as never }]
    expect(() => parseProject(projectJson(malformedFilter))).toThrow('incomplete or damaged')
    const malformedAnnotation = makeProject('Good', sampleDataset, [graph()], 'one', 'embedded')
    if (malformedAnnotation.data.mode === 'embedded') malformedAnnotation.data.dataset.importedAnnotations = { referenceLines: [], referenceRegions: 'broken' as never }
    expect(() => parseProject(projectJson(malformedAnnotation))).toThrow('invalid data information')
    const missingColumn = makeProject('Good', sampleDataset, [graph()], 'one', 'embedded')
    if (missingColumn.data.mode === 'embedded') missingColumn.data.dataset.columns = missingColumn.data.dataset.columns.filter((column) => column.id !== 'pressure')
    expect(() => parseProject(projectJson(missingColumn))).toThrow()
  })
})
