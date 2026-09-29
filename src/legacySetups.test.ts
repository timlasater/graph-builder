import { describe, expect, it } from 'vitest'
import { datasetSignature } from './datasetSignature'
import { readLegacyTemplates } from './legacySetups'
import { sampleDataset } from './sampleData'
import { defaultGraphSpec } from './store'

describe('previous saved graph recovery', () => {
  it('offers valid browser-saved graphs as reusable templates without erasing storage', () => {
    const value = JSON.stringify([{ version: 1, id: 'old-1', name: 'Dose summary', sourceName: 'Study', sourceSignature: datasetSignature(sampleDataset), spec: defaultGraphSpec(sampleDataset), filters: [], createdAt: '2026-09-01', updatedAt: '2026-09-01' }, { version: 2, name: 'unsupported' }])
    const storage = { getItem: (key: string) => key === 'graph-builder.plot-setups.v1' ? value : null } as Storage
    const templates = readLegacyTemplates(storage)
    expect(templates).toHaveLength(1)
    expect(templates[0]).toMatchObject({ format: 'graphbuilder-template', name: 'Dose summary', sourceSignature: datasetSignature(sampleDataset) })
    expect(storage.getItem('graph-builder.plot-setups.v1')).toBe(value)
  })

  it('ignores corrupt browser storage', () => {
    expect(readLegacyTemplates({ getItem: () => '{' } as unknown as Storage)).toEqual([])
  })
})
