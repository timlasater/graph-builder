// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { clearRecovery, readRecovery, saveRecovery } from './recovery'
import { makeProject } from './projects'
import { sampleDataset } from './sampleData'
import { useBuilderStore } from './store'

afterEach(async () => { await clearRecovery() })

describe('local recovery', () => {
  it('saves and restores an embedded project without a server', async () => {
    const project = makeProject('Recovered', sampleDataset, [{ id: 'one', name: 'Graph', spec: useBuilderStore.getState().spec, filters: [] }], 'one', 'embedded')
    await saveRecovery(project)
    expect(await readRecovery()).toEqual(project)
    await clearRecovery()
    expect(await readRecovery()).toBeUndefined()
  })
})
