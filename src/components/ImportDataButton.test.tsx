// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ImportDataButton } from './ImportDataButton'

describe('ImportDataButton file dropping', () => {
  it('shows a drop target and imports a file dropped anywhere in the app', async () => {
    const onImport = vi.fn()
    render(<ImportDataButton onImport={onImport} onProjectDrop={vi.fn()} />)
    const file = new File(['Group,Value\nA,12\nB,18'], 'dropped.csv', { type: 'text/csv' })
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' }

    fireEvent.dragEnter(window, { dataTransfer })
    expect(screen.getByRole('status').textContent).toContain('Drop data or project file to open')

    fireEvent.drop(window, { dataTransfer })
    fireEvent.click(await screen.findByRole('button', { name: 'Import selected data' }))
    await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
    expect(onImport.mock.calls[0][0]).toMatchObject({ name: 'dropped', rows: expect.arrayContaining([expect.objectContaining({ values: expect.any(Object) })]) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ignores internal non-file dragging', () => {
    render(<ImportDataButton onImport={vi.fn()} onProjectDrop={vi.fn()} />)
    fireEvent.dragEnter(window, { dataTransfer: { types: ['text/plain'], files: [] } })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('routes a dropped project file to the project opener', () => {
    const onProjectDrop = vi.fn()
    render(<ImportDataButton onImport={vi.fn()} onProjectDrop={onProjectDrop} />)
    const file = new File(['{}'], 'study.graphbuilder')
    fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [file] } })
    expect(onProjectDrop).toHaveBeenCalledWith(file)
  })
})
