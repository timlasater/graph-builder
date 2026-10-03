// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readDesktopFile } from '../desktopFiles'
import { importPreparedFile, prepareTabularFile } from '../importData'
import { sampleDataset } from '../sampleData'
import { ImportDataButton } from './ImportDataButton'

const nativeDrop = vi.hoisted(() => ({ handler: undefined as ((event: { payload: { type: 'drop'; paths: string[] } }) => void) | undefined }))

vi.mock('../desktopFiles', () => ({
  isDesktop: () => true,
  readDesktopFile: vi.fn(),
  chooseDesktopFile: vi.fn(),
  desktopOpenKind: (path: string) => path.toLowerCase().endsWith('.graphbuilder') ? 'project' : 'data',
}))
vi.mock('../importData', () => ({ prepareTabularFile: vi.fn(), importPreparedFile: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ onDragDropEvent: (handler: typeof nativeDrop.handler) => { nativeDrop.handler = handler; return Promise.resolve(() => {}) } }) }))

beforeEach(() => {
  vi.clearAllMocks()
  nativeDrop.handler = undefined
  vi.mocked(readDesktopFile).mockResolvedValue(new File(['a,b\n1,2'], 'measurements.csv'))
  vi.mocked(prepareTabularFile).mockResolvedValue({ fileName: 'measurements.csv', kind: 'text', sheets: [{ name: 'Sheet 1', matrix: [['a', 'b'], [1, 2]] }] })
  vi.mocked(importPreparedFile).mockReturnValue([{ name: 'Sheet 1', dataset: sampleDataset }])
})

it('opens a project path dropped from Windows File Explorer', async () => {
  const onProjectDrop = vi.fn()
  render(<ImportDataButton onImport={vi.fn()} onProjectDrop={onProjectDrop} />)
  await waitFor(() => expect(nativeDrop.handler).toBeDefined())
  act(() => nativeDrop.handler?.({ payload: { type: 'drop', paths: ['C:\\Studies\\study.graphbuilder'] } }))
  expect(onProjectDrop).toHaveBeenCalledWith('C:\\Studies\\study.graphbuilder')
  expect(readDesktopFile).not.toHaveBeenCalled()
})
afterEach(() => document.body.replaceChildren())

it('imports a desktop data path selected by the combined open dialog once', async () => {
  const onImport = vi.fn()
  const openRequest = { id: 1, path: 'C:\\Studies\\measurements.csv' }
  const onProjectDrop = vi.fn()
  const view = render(<ImportDataButton onImport={onImport} onProjectDrop={onProjectDrop} openRequest={openRequest} />)

  fireEvent.click(await screen.findByRole('button', { name: 'Import selected data' }))
  await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
  expect(readDesktopFile).toHaveBeenCalledWith(openRequest.path)
  expect(onImport.mock.calls[0][0].source.nativePath).toBe(openRequest.path)
  view.rerender(<ImportDataButton onImport={onImport} onProjectDrop={onProjectDrop} openRequest={openRequest} />)
  expect(readDesktopFile).toHaveBeenCalledOnce()
})

it('uses the native path for a File Explorer drop even when the webview also reports the file', async () => {
  const onImport = vi.fn()
  render(<ImportDataButton onImport={onImport} onProjectDrop={vi.fn()} />)
  await waitFor(() => expect(nativeDrop.handler).toBeDefined())
  fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [new File(['a,b\n1,2'], 'measurements.csv')] } })
  act(() => nativeDrop.handler?.({ payload: { type: 'drop', paths: ['C:\\Studies\\measurements.csv'] } }))
  fireEvent.click(await screen.findByRole('button', { name: 'Import selected data' }))
  await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
  expect(readDesktopFile).toHaveBeenCalledOnce()
  expect(onImport.mock.calls[0][0].source.nativePath).toBe('C:\\Studies\\measurements.csv')
})
