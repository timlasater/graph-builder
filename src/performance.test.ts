import { describe, expect, it } from 'vitest'
import { datasetFromMatrix } from './importData'
import { histogramBins, linearFit } from './plotTransforms'
import { summaryStatistics } from './statistics'
import { makeProject, projectJson } from './projects'
import { defaultGraphSpec, rowMatchesFilters } from './store'

const measure = (rows: number) => {
  const source = [['Pressure', 'Dose', 'Group', 'Lot', 'Date', 'Run', 'Yield', 'Flow', 'Temperature', 'Operator']]
  for (let index = 0; index < rows; index += 1) source.push([
    String(10 + index % 100), String(20 + index % 70), index % 2 ? 'A' : 'B', `L${index % 20}`,
    '2026-01-01', String(index), String(50 + index % 40), String(index % 50), String(index % 30), `O${index % 5}`,
  ])
  const start = performance.now()
  const dataset = datasetFromMatrix(source, 'Performance fixture')
  const importedMs = performance.now() - start
  const pressure = dataset.rows.map((row) => Number(row.values[dataset.columns[0].id]))
  const dose = dataset.rows.map((row) => Number(row.values[dataset.columns[1].id]))
  const calculationsStart = performance.now()
  const summary = summaryStatistics(dose)
  const bins = histogramBins(dose, 20)
  const fit = linearFit(pressure, dose)
  const visible = dataset.rows.filter((row) => rowMatchesFilters(row, [{ id: 'group-a', columnId: dataset.columns[2].id, operator: 'equals', value: 'A' }]))
  const calculationsMs = performance.now() - calculationsStart
  const saveStart = performance.now()
  const spec = defaultGraphSpec(dataset)
  const saved = projectJson(makeProject('Performance fixture', dataset, [{ id: 'g1', name: spec.title, spec, filters: [] }], 'g1', 'embedded'))
  const saveMs = performance.now() - saveStart
  return { dataset, importedMs, calculationsMs, saveMs, summary, bins, fit, visible, saved }
}

describe('performance measurements', () => {
  it.each([500, 5000])('measures import, calculations/filter, and save for %i rows', (rows) => {
    const result = measure(rows)
    expect(result.dataset.rows).toHaveLength(rows)
    expect(result.dataset.columns).toHaveLength(10)
    expect(result.visible).toHaveLength(rows / 2)
    expect(result.summary.n).toBe(rows)
    expect(result.bins.counts.reduce((sum, value) => sum + value, 0)).toBe(rows)
    expect(result.fit).not.toBeNull()
    expect(result.saved.length).toBeGreaterThan(rows * 10)
    console.info(`${rows} rows / ${rows * 10} cells: import ${result.importedMs.toFixed(1)} ms; statistics + filter ${result.calculationsMs.toFixed(1)} ms; serialize ${result.saveMs.toFixed(1)} ms`)
  })
})
