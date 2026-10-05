// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { navigationShortcut } from './navigationShortcuts'

describe('navigation shortcuts', () => {
  it('creates a graph with Ctrl+N only in the desktop app', () => {
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }), true, false)).toBe('newGraph')
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }), false, false)).toBeUndefined()
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'N', metaKey: true }), true, false)).toBeUndefined()
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }), true, true)).toBeUndefined()
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, shiftKey: true }), true, false)).toBeUndefined()
  })
  it('opens the data table with Ctrl+D only in the desktop app', () => {
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }), true, false)).toBe('dataTable')
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }), false, false)).toBeUndefined()
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }), true, true)).toBeUndefined()
    const input = document.createElement('input')
    let result: ReturnType<typeof navigationShortcut>
    input.addEventListener('keydown', (event) => { result = navigationShortcut(event, true, false) })
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }))
    expect(result).toBeUndefined()
  })
  it('opens Projects & export with Ctrl+E only in the desktop app', () => {
    const event = new KeyboardEvent('keydown', { key: 'e', ctrlKey: true })
    expect(navigationShortcut(event, true, false)).toBe('projects')
    expect(navigationShortcut(event, false, false)).toBeUndefined()
    expect(navigationShortcut(event, true, true)).toBeUndefined()
  })

  it('opens help with ? but leaves typing and other dialogs alone', () => {
    const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true })
    expect(navigationShortcut(event, true, false)).toBe('help')
    expect(navigationShortcut(event, false, false)).toBe('help')
    expect(navigationShortcut(event, false, true)).toBeUndefined()
    expect(navigationShortcut(new KeyboardEvent('keydown', { key: '/', shiftKey: true }), false, false)).toBe('help')

    const input = document.createElement('input')
    let result: ReturnType<typeof navigationShortcut>
    input.addEventListener('keydown', (typed) => { result = navigationShortcut(typed, true, false) })
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }))
    expect(result).toBeUndefined()
  })
})
