// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutHelp } from './ShortcutHelp'

describe('shortcut help by platform', () => {
  afterEach(cleanup)

  it('shows only app-owned browser shortcuts', () => {
    render(<ShortcutHelp desktop={false} onClose={vi.fn()} onFullGuide={vi.fn()} />)
    const dialog = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
    expect(dialog.getByText('Ctrl+Z / Ctrl+Y')).toBeTruthy()
    expect(dialog.getByText('?')).toBeTruthy()
    for (const shortcut of ['Ctrl+N', 'Ctrl+D', 'Ctrl+O', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+E', 'Mouse Back / Forward']) {
      expect(dialog.queryByText(shortcut)).toBeNull()
    }
  })

  it('keeps the full Windows shortcut list', () => {
    render(<ShortcutHelp desktop onClose={vi.fn()} onFullGuide={vi.fn()} />)
    const dialog = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
    for (const shortcut of ['Ctrl+N', 'Ctrl+D', 'Ctrl+O', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+E', 'Ctrl+Z / Ctrl+Y', 'Mouse Back / Forward', '?']) {
      expect(dialog.getByText(shortcut)).toBeTruthy()
    }
  })
})
