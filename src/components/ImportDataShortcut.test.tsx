// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readDesktopFile } from '../desktopFiles'
import { importTabularFile } from '../importData'
import { sampleDataset } from '../sampleData'
import { ImportDataButton } from './ImportDataButton'

vi.mock('../desktopFiles', () => ({
  isDesktop: () => true,
  readDesktopFile: vi.fn(),
  chooseDesktopFile: vi.fn(),
}))
vi.mock('../importData', () => ({ importTabularFile: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readDesktopFile).mockResolvedValue(new File(['a,b\n1,2'], 'measurements.csv'))
  vi.mocked(importTabularFile).mockResolvedValue([{ name: 'Sheet 1', dataset: sampleDataset }])
})
afterEach(() => document.body.replaceChildren())

it('imports a desktop data path selected by the combined open dialog once', async () => {
  const onImport = vi.fn()
  const openRequest = { id: 1, path: 'C:\\Studies\\measurements.csv' }
  const view = render(<ImportDataButton onImport={onImport} openRequest={openRequest} />)

  await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
  expect(readDesktopFile).toHaveBeenCalledWith(openRequest.path)
  expect(onImport.mock.calls[0][0].source.nativePath).toBe(openRequest.path)
  view.rerender(<ImportDataButton onImport={onImport} openRequest={openRequest} />)
  expect(readDesktopFile).toHaveBeenCalledOnce()
})
