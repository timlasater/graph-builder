// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { chooseDesktopFile, isDesktop, readDesktopFile } from '../desktopFiles'
import { importTabularFile } from '../importData'
import { sampleDataset } from '../sampleData'
import { withFileSource } from '../sourceData'
import { projectGraphs, useBuilderStore } from '../store'
import { RefreshLinkedSource } from './RefreshLinkedSource'

vi.mock('../desktopFiles', () => ({ isDesktop: vi.fn(() => true), readDesktopFile: vi.fn(), chooseDesktopFile: vi.fn() }))
vi.mock('../importData', async (original) => ({ ...await original<typeof import('../importData')>(), importTabularFile: vi.fn() }))

const path = 'C:\\Studies\\results.csv'
const file = new File(['source'], 'results.csv')
const fresh = () => ({ ...structuredClone(sampleDataset), rows: [{ id: 'fresh-row', excluded: false, values: { ...sampleDataset.rows[0].values, dose: 123 } }] })
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(isDesktop).mockReturnValue(true)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  useBuilderStore.getState().reset()
  const dataset = withFileSource({ name: 'Results', dataset: structuredClone(sampleDataset) }, file.name, undefined, path, 2)
  dataset.columns.push({ id: 'double_dose', name: 'Double dose', dataType: 'number', modelingType: 'continuous', formula: '[dose] * 2' })
  useBuilderStore.getState().setDataset(dataset)
  useBuilderStore.getState().setProjectMode('linked')
  useBuilderStore.getState().setProjectPath('C:\\Studies\\project.graphbuilder')
  useBuilderStore.getState().duplicateGraph()
  useBuilderStore.getState().setFigureLayout({ title: 'Figure', graphIds: projectGraphs(useBuilderStore.getState()).map((g) => g.id), columns: 2, width: 1200, height: 900 })
  vi.mocked(readDesktopFile).mockResolvedValue(file)
  vi.mocked(importTabularFile).mockResolvedValue([{ name: 'Results', dataset: fresh() }])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('reloads source rows and formulas for all graphs, keeps project settings, and supports undo/redo', async () => {
  const before = useBuilderStore.getState()
  render(<RefreshLinkedSource />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  await screen.findByText(/Linked source refreshed: 1 row/)
  const after = useBuilderStore.getState()
  expect(readDesktopFile).toHaveBeenCalledWith(path)
  expect(importTabularFile).toHaveBeenCalledWith(file, 2)
  expect(after.dataset.rows[0].values.double_dose).toBe(246)
  expect(after.dataset.source?.nativePath).toBe(path)
  expect(projectGraphs(after)).toEqual(projectGraphs(before))
  expect(after.figureLayout).toEqual(before.figureLayout)
  expect(after.projectPath).toBe(before.projectPath)
  expect(after.projectMode).toBe('linked')
  act(() => after.undo())
  expect(useBuilderStore.getState().dataset).toEqual(before.dataset)
  act(() => useBuilderStore.getState().redo())
  expect(useBuilderStore.getState().dataset).toEqual(after.dataset)
})

it('asks for a moved source and remembers the new location', async () => {
  vi.mocked(readDesktopFile).mockRejectedValueOnce(new Error('File moved'))
  vi.mocked(chooseDesktopFile).mockResolvedValue('D:\\New\\results.csv')
  render(<RefreshLinkedSource />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  await screen.findByText(/Linked source refreshed/)
  expect(chooseDesktopFile).toHaveBeenCalledWith('source', path)
  expect(useBuilderStore.getState().dataset.source?.nativePath).toBe('D:\\New\\results.csv')
})

it('leaves data unchanged when confirmation or file selection is canceled', async () => {
  const before = useBuilderStore.getState().dataset
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  render(<RefreshLinkedSource />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  expect(readDesktopFile).not.toHaveBeenCalled()
  vi.mocked(readDesktopFile).mockRejectedValue(new Error('Missing file'))
  vi.mocked(chooseDesktopFile).mockResolvedValue(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  await screen.findByText(/Refresh canceled/)
  expect(useBuilderStore.getState().dataset).toBe(before)
})

it.each(['incompatible', 'unreadable'])('keeps data when the source is %s', async (kind) => {
  const before = useBuilderStore.getState().dataset
  if (kind === 'incompatible') vi.mocked(importTabularFile).mockResolvedValue([{ name: 'Results', dataset: { ...fresh(), columns: [] } }])
  else vi.mocked(importTabularFile).mockRejectedValue(new Error('Cannot read source'))
  render(<RefreshLinkedSource />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  await screen.findByText(/Your current data is unchanged/)
  expect(useBuilderStore.getState().dataset).toBe(before)
})

it('does not overwrite a different project if the source read finishes later', async () => {
  let resolve!: (file: File) => void
  vi.mocked(readDesktopFile).mockReturnValue(new Promise((done) => { resolve = done }))
  render(<RefreshLinkedSource />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  act(() => useBuilderStore.getState().setDataset(structuredClone(sampleDataset)))
  const current = useBuilderStore.getState().dataset
  await act(async () => { resolve(file) })
  expect(useBuilderStore.getState().dataset).toBe(current)
})

it('refreshes from the browser file picker without using desktop access', async () => {
  vi.mocked(isDesktop).mockReturnValue(false)
  render(<RefreshLinkedSource />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  fireEvent.change(screen.getByLabelText('Choose linked source to refresh'), { target: { files: [file] } })
  await screen.findByText(/Linked source refreshed/)
  expect(readDesktopFile).not.toHaveBeenCalled()
  expect(useBuilderStore.getState().dataset.source?.nativePath).toBeUndefined()
})

it('starts the shortcut refresh once and hides the control for embedded projects', async () => {
  const { rerender } = render(<RefreshLinkedSource initialRefresh />)
  await screen.findByText(/Linked source refreshed/)
  rerender(<RefreshLinkedSource initialRefresh />)
  expect(readDesktopFile).toHaveBeenCalledOnce()
  act(() => useBuilderStore.getState().setProjectMode('embedded'))
  await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
})

it('allows another refresh after canceling the browser picker, including after switching to linked mode', () => {
  vi.mocked(isDesktop).mockReturnValue(false)
  useBuilderStore.getState().setProjectMode('embedded')
  render(<RefreshLinkedSource />)
  act(() => useBuilderStore.getState().setProjectMode('linked'))
  const before = useBuilderStore.getState().dataset
  fireEvent.click(screen.getByRole('button', { name: 'Refresh linked source' }))
  fireEvent(screen.getByLabelText('Choose linked source to refresh'), new Event('cancel'))
  expect((screen.getByRole('button', { name: 'Refresh linked source' }) as HTMLButtonElement).disabled).toBe(false)
  expect(useBuilderStore.getState().dataset).toBe(before)
})
