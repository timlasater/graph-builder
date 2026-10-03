// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveDesktopText } from '../desktopFiles'
import { parseProject } from '../projects'
import { sampleDataset } from '../sampleData'
import { withFileSource } from '../sourceData'
import { useBuilderStore } from '../store'
import { ProjectModal } from './ProjectModal'

vi.mock('../desktopFiles', async (importOriginal) => ({
  ...await importOriginal<typeof import('../desktopFiles')>(),
  isDesktop: () => true,
  saveDesktopText: vi.fn(),
  recentProjects: () => [],
  rememberProject: vi.fn(),
}))
vi.mock('./DesktopUpdater', () => ({ DesktopUpdater: () => null }))

describe('desktop project save choice', () => {
  beforeEach(() => { vi.clearAllMocks(); useBuilderStore.getState().reset() })
  afterEach(cleanup)

  it('offers embedded and linked modes before choosing a file location', async () => {
    vi.mocked(saveDesktopText).mockResolvedValue('C:\\Studies\\saved.graphbuilder')
    render(<ProjectModal onClose={vi.fn()} autosaveStatus="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Save project…' }))
    const dialog = screen.getByRole('dialog', { name: 'Save project' })
    expect(dialog.querySelector('select')?.textContent).toContain('Linked — reconnect source')
    fireEvent.click(screen.getByRole('button', { name: 'Choose file location…' }))
    await waitFor(() => expect(saveDesktopText).toHaveBeenCalledOnce())
    expect(parseProject(vi.mocked(saveDesktopText).mock.calls[0][1]).data.mode).toBe('embedded')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save project' })).toBeNull())
  })

  it('opens the same choice immediately for Save As shortcuts', () => {
    render(<ProjectModal onClose={vi.fn()} autosaveStatus="" initialSavePrompt />)
    expect(screen.getByRole('dialog', { name: 'Save project' })).toBeTruthy()
  })

  it('saves a linked file when that mode is chosen for imported data', async () => {
    useBuilderStore.getState().setDataset(withFileSource({ name: 'Measurements', dataset: structuredClone(sampleDataset) }, 'measurements.csv', undefined, 'C:\\Studies\\measurements.csv'))
    vi.mocked(saveDesktopText).mockResolvedValue('C:\\Studies\\linked.graphbuilder')
    render(<ProjectModal onClose={vi.fn()} autosaveStatus="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Save project…' }))
    const dialog = screen.getByRole('dialog', { name: 'Save project' })
    fireEvent.change(dialog.querySelector('select')!, { target: { value: 'linked' } })
    fireEvent.click(screen.getByRole('button', { name: 'Choose file location…' }))
    await waitFor(() => expect(saveDesktopText).toHaveBeenCalledOnce())
    expect(parseProject(vi.mocked(saveDesktopText).mock.calls[0][1]).data.mode).toBe('linked')
  })
})
