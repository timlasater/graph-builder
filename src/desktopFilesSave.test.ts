// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { chooseDesktopFile, clearRecentProjects, recentProjects, rememberProject, saveDesktopText } from './desktopFiles'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: vi.fn(), readTextFile: vi.fn(), stat: vi.fn(), writeFile: vi.fn(), writeTextFile: vi.fn() }))

describe('desktop project backup', () => {
  beforeEach(() => { vi.clearAllMocks(); clearRecentProjects() })

  it('refuses to overwrite the project that is about to open', async () => {
    vi.mocked(save).mockResolvedValue('c:/studies/INCOMING.graphbuilder')
    await expect(saveDesktopText('current.graphbuilder', '{}', 'graphbuilder', 'C:\\Studies\\incoming.graphbuilder')).rejects.toThrow('different file name')
    expect(writeTextFile).not.toHaveBeenCalled()
  })

  it('offers data and project extensions in the Ctrl+O picker', async () => {
    vi.mocked(save).mockResolvedValue(null)
    await chooseDesktopFile('open')
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ filters: [expect.objectContaining({ extensions: expect.arrayContaining(['csv', 'xlsx', 'graphbuilder', 'graphbuilder.json']) })] }))
  })

  it('starts source reconnection in the last known folder', async () => {
    await chooseDesktopFile('source', 'C:\\Studies\\Trial\\measurements.csv')
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'C:\\Studies\\Trial' }))
    await chooseDesktopFile('source', 'C:\\measurements.csv')
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: 'C:\\' }))
    await chooseDesktopFile('source')
    expect(open).toHaveBeenLastCalledWith(expect.not.objectContaining({ defaultPath: expect.any(String) }))
  })

  it('opens the ordinary picker if the last known folder is gone', async () => {
    vi.mocked(open).mockRejectedValueOnce(new Error('Folder no longer exists')).mockResolvedValueOnce('C:\\Moved\\measurements.csv')
    await expect(chooseDesktopFile('source', 'C:\\Old\\measurements.csv')).resolves.toBe('C:\\Moved\\measurements.csv')
    expect(open).toHaveBeenNthCalledWith(1, expect.objectContaining({ defaultPath: 'C:\\Old' }))
    expect(open).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ defaultPath: expect.any(String) }))
  })

  it('clears the recent-project list', () => {
    rememberProject('C:\\Studies\\first.graphbuilder', 'First')
    expect(recentProjects()).toHaveLength(1)
    clearRecentProjects()
    expect(recentProjects()).toEqual([])
  })
})
