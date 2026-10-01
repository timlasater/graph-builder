// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function BrokenView(): never { throw new Error('Rendering failed') }

describe('app error recovery', () => {
  it('shows a readable recovery path when a view throws', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<AppErrorBoundary><BrokenView /></AppErrorBoundary>)
      expect(screen.getByRole('alert').textContent).toContain('Graph Builder hit a display problem')
      expect(screen.getByRole('button', { name: 'Reload Graph Builder' })).toBeDefined()
      expect(screen.getByRole('alert').textContent).toContain('.graphbuilder')
    } finally { log.mockRestore() }
  })
})
