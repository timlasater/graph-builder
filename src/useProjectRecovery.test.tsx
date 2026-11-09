// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useProjectRecovery } from './useProjectRecovery'
import { makeProject } from './projects'
import { projectGraphs, useBuilderStore } from './store'
import { sampleDataset } from './sampleData'

const storage = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), clear: vi.fn() }))
vi.mock('./recovery', () => ({ readRecovery: storage.read, saveRecovery: storage.save, clearRecovery: storage.clear }))
const original = useBuilderStore.getState()
afterEach(() => { cleanup(); useBuilderStore.setState(original); vi.clearAllMocks() })

it('quietly restores customized graphs using unchanged example data', async () => {
  const saved = makeProject('Example practice', sampleDataset, projectGraphs({ ...original, spec: { ...original.spec, title: 'Practice boxes' } }), original.activeGraphId, 'embedded')
  storage.read.mockResolvedValue(saved)
  const { result } = renderHook(() => useProjectRecovery())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.recovery).toBeUndefined()
  expect(useBuilderStore.getState().spec.title).toBe('Practice boxes')
})

it.each(['edited', 'imported'])('still offers recovery for %s data', async (kind) => {
  const dataset = structuredClone(sampleDataset)
  if (kind === 'edited') dataset.rows[0].values.dose = 123
  else dataset.source = { fileName: 'measurements.csv', signature: 'imported' }
  const saved = makeProject('My work', dataset, projectGraphs(original), original.activeGraphId, 'embedded')
  storage.read.mockResolvedValue(saved)
  const { result } = renderHook(() => useProjectRecovery())
  await waitFor(() => expect(result.current.recovery).toEqual(saved))
  expect(result.current.ready).toBe(false)
  expect(useBuilderStore.getState().dataset).toEqual(original.dataset)
})
