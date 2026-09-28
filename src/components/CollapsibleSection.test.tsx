// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CollapsibleSection } from './CollapsibleSection'

describe('CollapsibleSection', () => {
  it('hides its controls and keeps its state during a parent update', () => {
    const view = render(<CollapsibleSection title="Graph"><input aria-label="Title" /></CollapsibleSection>)
    const toggle = screen.getByRole('button', { name: 'Graph' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull()
    view.rerender(<CollapsibleSection title="Graph"><input aria-label="Title" value="Updated" readOnly /></CollapsibleSection>)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveProperty('value', 'Updated')
  })
})
