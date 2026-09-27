// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ImportDataButton } from './ImportDataButton'

describe('ImportDataButton file dropping', () => {
  it('shows a drop target and imports a file dropped anywhere in the app', async () => {
    const onImport = vi.fn()
    render(<ImportDataButton onImport={onImport} />)
    const file = new File(['Group,Value\nA,12\nB,18'], 'dropped.csv', { type: 'text/csv' })
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' }

    fireEvent.dragEnter(window, { dataTransfer })
    expect(screen.getByRole('status').textContent).toContain('Drop data file to import')

    fireEvent.drop(window, { dataTransfer })
    await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
    expect(onImport.mock.calls[0][0]).toMatchObject({ name: 'dropped', rows: expect.arrayContaining([expect.objectContaining({ values: expect.any(Object) })]) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ignores internal non-file dragging', () => {
    render(<ImportDataButton onImport={vi.fn()} />)
    fireEvent.dragEnter(window, { dataTransfer: { types: ['text/plain'], files: [] } })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
