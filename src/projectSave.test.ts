import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rememberProject, saveDesktopText, writeDesktopText } from './desktopFiles'
import { parseProject } from './projects'
import { saveCurrentDesktopProject } from './projectSave'
import { hasUnsavedProjectChanges, useBuilderStore } from './store'

vi.mock('./desktopFiles', () => ({
  rememberProject: vi.fn(),
  saveDesktopText: vi.fn(),
  writeDesktopText: vi.fn(),
}))
vi.mock('./graphExport', () => ({ safeFileName: (name: string) => name }))

describe('desktop project shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBuilderStore.getState().reset()
  })

  it('updates the open file for Save and includes current data edits', async () => {
    const store = useBuilderStore.getState()
    store.setProjectPath('C:\\Studies\\current.graphbuilder')
    store.setProjectMode('linked')
    store.updateCell(store.dataset.rows[0].id, 'dose', 777)

    expect(await saveCurrentDesktopProject(false)).toBe('C:\\Studies\\current.graphbuilder')
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(false)
    expect(useBuilderStore.getState().projectMode).toBe('embedded')
    expect(saveDesktopText).not.toHaveBeenCalled()
    expect(writeDesktopText).toHaveBeenCalledOnce()
    const [path, content] = vi.mocked(writeDesktopText).mock.calls[0]
    expect(path).toBe('C:\\Studies\\current.graphbuilder')
    const saved = parseProject(content)
    expect(saved.data.mode).toBe('embedded')
    if (saved.data.mode === 'embedded') expect(saved.data.dataset.rows[0].values.dose).toBe(777)
  })

  it('asks for a path only when the project has not been saved yet', async () => {
    vi.mocked(saveDesktopText).mockResolvedValue('C:\\Studies\\first-save.graphbuilder')

    expect(await saveCurrentDesktopProject(false, 'C:\\Studies\\incoming.graphbuilder')).toBe('C:\\Studies\\first-save.graphbuilder')
    expect(saveDesktopText).toHaveBeenCalledWith(`${useBuilderStore.getState().projectName}.graphbuilder`, expect.any(String), 'graphbuilder', 'C:\\Studies\\incoming.graphbuilder')
    expect(useBuilderStore.getState().projectPath).toBe('C:\\Studies\\first-save.graphbuilder')
    expect(writeDesktopText).not.toHaveBeenCalled()
  })

  it('asks for a path for Save As and remembers the chosen file', async () => {
    useBuilderStore.getState().setProjectPath('C:\\Studies\\old.graphbuilder')
    vi.mocked(saveDesktopText).mockResolvedValue('C:\\Studies\\new.graphbuilder')

    expect(await saveCurrentDesktopProject(true)).toBe('C:\\Studies\\new.graphbuilder')
    expect(hasUnsavedProjectChanges(useBuilderStore.getState())).toBe(false)
    expect(writeDesktopText).not.toHaveBeenCalled()
    expect(useBuilderStore.getState().projectPath).toBe('C:\\Studies\\new.graphbuilder')
    expect(rememberProject).toHaveBeenCalledWith('C:\\Studies\\new.graphbuilder', useBuilderStore.getState().projectName)
  })

  it('keeps the open file when Save As is canceled', async () => {
    useBuilderStore.getState().setProjectPath('C:\\Studies\\old.graphbuilder')
    vi.mocked(saveDesktopText).mockResolvedValue(undefined)

    expect(await saveCurrentDesktopProject(true)).toBeUndefined()
    expect(useBuilderStore.getState().projectPath).toBe('C:\\Studies\\old.graphbuilder')
    expect(rememberProject).not.toHaveBeenCalled()
  })
})
