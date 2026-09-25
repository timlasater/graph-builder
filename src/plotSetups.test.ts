import { describe, expect, it } from 'vitest'
import { datasetSignature, isSetupCompatible, makePlotSetup, readPlotSetups, writePlotSetups } from './plotSetups'
import { sampleDataset } from './sampleData'
import { defaultGraphSpec } from './store'

describe('saved plot setups', () => {
  const memoryStorage = (): Storage => {
    const values = new Map<string, string>()
    return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key) }, setItem: (key, value) => { values.set(key, value) } }
  }

  it('round-trips a versioned setup without sharing mutable graph state', () => {
    const storage = memoryStorage()
    const spec = defaultGraphSpec(sampleDataset)
    const setup = makePlotSetup('Dose summary', sampleDataset, spec, [])
    writePlotSetups([setup], storage)
    spec.title = 'Changed after save'
    const restored = readPlotSetups(storage)[0]
    expect(restored.name).toBe('Dose summary')
    expect(restored.spec.title).not.toBe('Changed after save')
    expect(restored.sourceSignature).toBe(datasetSignature(sampleDataset))
  })

  it('only enables a setup for a matching column schema', () => {
    const setup = makePlotSetup('Compatible', sampleDataset, defaultGraphSpec(sampleDataset), [])
    expect(isSetupCompatible(setup, sampleDataset)).toBe(true)
    expect(isSetupCompatible(setup, { ...sampleDataset, columns: sampleDataset.columns.slice(1) })).toBe(false)
  })

  it('ignores corrupt or unsupported saved records', () => {
    const storage = memoryStorage()
    storage.setItem('graph-builder.plot-setups.v1', JSON.stringify([{ version: 2 }, null]))
    expect(readPlotSetups(storage)).toEqual([])
  })
})
