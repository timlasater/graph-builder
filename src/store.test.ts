import { beforeEach, describe, expect, it } from 'vitest'
import { moveRoleAssignment, useBuilderStore } from './store'

describe('graph history', () => {
  beforeEach(() => {
    useBuilderStore.setState({ past: [], future: [] })
  })

  it('restores an earlier graph element with undo and redo', () => {
    const original = useBuilderStore.getState().spec.element

    useBuilderStore.getState().setElement(original === 'points' ? 'line' : 'points')
    const changed = useBuilderStore.getState().spec.element
    expect(changed).not.toBe(original)

    useBuilderStore.getState().undo()
    expect(useBuilderStore.getState().spec.element).toBe(original)

    useBuilderStore.getState().redo()
    expect(useBuilderStore.getState().spec.element).toBe(changed)
  })
})

describe('role assignment moves', () => {
  it('removes Wrap when assigning Group X', () => {
    const spec = { ...useBuilderStore.getState().spec, wrap: 'prototype' }
    const moved = moveRoleAssignment(spec, 'passed', 'groupX')

    expect(moved.groupX).toBe('passed')
    expect(moved.wrap).toBeUndefined()
  })

  it('removes both group roles when assigning Wrap', () => {
    const spec = { ...useBuilderStore.getState().spec, groupX: 'passed', groupY: 'prototype' }
    const moved = moveRoleAssignment(spec, 'run', 'wrap')

    expect(moved.wrap).toBe('run')
    expect(moved.groupX).toBeUndefined()
    expect(moved.groupY).toBeUndefined()
  })

  it('moves an assigned variable instead of copying it', () => {
    const spec = { ...useBuilderStore.getState().spec, overlay: 'run' }
    const moved = moveRoleAssignment(spec, 'run', 'color', 'overlay')

    expect(moved.color).toBe('run')
    expect(moved.overlay).toBeUndefined()
  })

  it('unassigns a variable dropped back on the Variables panel', () => {
    const spec = { ...useBuilderStore.getState().spec, size: 'pressure' }
    const moved = moveRoleAssignment(spec, 'pressure', undefined, 'size')

    expect(moved.size).toBeUndefined()
  })
})
