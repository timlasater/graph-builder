import { describe, expect, it } from 'vitest'
import { datasetFromMatrix, importTabularFile } from './importData'
import { makeProject, parseProject, projectJson } from './projects'
import { sampleDataset } from './sampleData'
import { projectGraphs, useBuilderStore } from './store'

describe('import edge cases and project integrity', () => {
  it('keeps source rows and unique column identifiers across deterministic ragged inputs', () => {
    let seed = 17
    const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
    for (let run = 0; run < 100; run += 1) {
      const width = 1 + Math.floor(next() * 10)
      const rows = Array.from({ length: 1 + Math.floor(next() * 20) }, () => Array.from({ length: width }, () => next() < .25 ? null : next() < .5 ? String(Math.floor(next() * 100)) : `v${Math.floor(next() * 10)}`))
      const dataset = datasetFromMatrix([Array.from({ length: width }, (_, index) => index === 0 ? 'First' : index % 3 ? 'Repeated' : ''), ...rows], `Fuzz ${run}`)
      expect(new Set(dataset.columns.map((column) => column.id)).size).toBe(dataset.columns.length)
      expect(dataset.rows).toHaveLength(rows.filter((row) => row.some((value) => value !== null)).length)
      expect(dataset.rows.every((row) => dataset.columns.every((column) => column.id in row.values))).toBe(true)
    }
  })

  it('rejects malformed CSV even when some rows parsed', async () => {
    const file = { name: 'broken.csv', text: async () => 'X,Y\n1,2\n"unterminated,3' } as File
    await expect(importTabularFile(file)).rejects.toThrow('CSV formatting error')
  })

  it('rejects non-finite data and missing graph columns without changing the open project', () => {
    const current = useBuilderStore.getState()
    const original = current.dataset
    const project = makeProject('Valid', sampleDataset, projectGraphs(current), current.activeGraphId, 'embedded')
    const corrupt = JSON.parse(projectJson(project))
    corrupt.data.dataset.rows[0].values.dose = { invalid: true }
    expect(() => parseProject(JSON.stringify(corrupt))).toThrow('invalid data information')
    expect(useBuilderStore.getState().dataset).toBe(original)
    const missing = JSON.parse(projectJson(project))
    missing.graphs[0].spec.y = ['missing-column']
    expect(() => parseProject(JSON.stringify(missing))).toThrow('missing')
    expect(useBuilderStore.getState().dataset).toBe(original)
  })
})
