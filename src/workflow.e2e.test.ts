import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('plotly.js-dist-min', () => ({ default: {} }))
import { datasetFromMatrix } from './importData'
import { setExportFigure, plottedDataCsv } from './graphExport'
import { makeProject, parseProject, projectJson } from './projects'
import { projectGraphs, rowMatchesFilters, useBuilderStore } from './store'
import { aggregateBars, boxSummary, histogramBins, linearFit } from './plotTransforms'

afterEach(() => { setExportFigure(undefined); useBuilderStore.getState().reset() })

describe('complete data-to-project workflow', () => {
  it('imports, edits, builds, filters, saves, reopens, and exports the plotted result', () => {
    const dataset = datasetFromMatrix([
      ['Pressure', 'Dose', 'Group', 'GB Type', 'GB Axis', 'GB Value'],
      [10, 20, 'A', '', '', ''], [20, 40, 'A', '', '', ''], [30, 70, 'B', '', '', ''],
      ['', '', '', 'reference-line', 'Y', 50],
    ], 'Nebulizer study')
    const store = useBuilderStore.getState()
    store.setDataset(dataset)
    const pressure = dataset.columns.find((column) => column.name === 'Pressure')!.id
    const dose = dataset.columns.find((column) => column.name === 'Dose')!.id
    const group = dataset.columns.find((column) => column.name === 'Group')!.id
    store.updateCell(dataset.rows[0].id, dose, 25)
    store.assign('x', pressure)
    store.assign('y', dose)
    store.assign('color', group)
    store.updateSpec({ title: 'Dose by pressure', xAxis: { title: 'Pressure (kPa)' }, yAxis: { title: 'Dose (mg)' } })
    store.setFilters([{ id: 'a-only', columnId: group, operator: 'equals', value: 'A' }])
    const state = useBuilderStore.getState()
    const visible = state.dataset.rows.filter((row) => !row.excluded && rowMatchesFilters(row, state.filters))
    expect(visible.map((row) => row.values[dose])).toEqual([25, 40])
    const saved = parseProject(projectJson(makeProject('Nebulizer study', state.dataset, projectGraphs(state), state.activeGraphId, 'embedded')))
    if (saved.data.mode !== 'embedded') throw new Error('Expected embedded project')
    store.reset()
    useBuilderStore.getState().openProject(saved.name, saved.data.dataset, saved.graphs, saved.activeGraphId)
    const reopened = useBuilderStore.getState()
    expect(reopened.dataset.rows[0].values[dose]).toBe(25)
    expect(reopened.spec).toMatchObject({ title: 'Dose by pressure', x: [pressure], y: [dose], color: group, yAxis: { title: 'Dose (mg)' } })
    expect(reopened.spec.referenceLines?.[0]).toMatchObject({ axis: 'y', value: 50 })
    expect(reopened.dataset.rows.filter((row) => rowMatchesFilters(row, reopened.filters))).toHaveLength(2)
    setExportFigure({ data: [{ type: 'scatter', name: 'A', x: visible.map((row) => row.values[pressure]), y: visible.map((row) => row.values[dose]) }], layout: {}, legendPlacement: 'bottom' })
    expect(plottedDataCsv()).toContain('A,scatter,10,25')
  })
})

describe('independent reference calculations', () => {
  it('matches hand-worked regression, histogram, box, and grouped bars', () => {
    expect(linearFit([1, 2, 3], [3, 5, 7])).toMatchObject({ slope: 2, intercept: 1, rSquared: 1 })
    expect(histogramBins([0, 0, 1, 2, 2], 2, [0, 2])).toEqual({ centers: [0.5, 1.5], counts: [2, 3], width: 1 })
    expect(boxSummary([1, 2, 3, 4, 5])).toMatchObject({ q1: 2, median: 3, q3: 4, lowerWhisker: 1, upperWhisker: 5, outliers: [] })
    expect(aggregateBars(['A', 'A', 'B'], [2, 6, 10], 'mean')).toEqual([{ key: 'A', value: 4, n: 2 }, { key: 'B', value: 10, n: 1 }])
  })
})
