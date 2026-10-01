// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { recentProjects, rememberProject } from './desktopFiles'

describe('desktop recent projects', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the newest path first without duplicates', () => {
    rememberProject('C:\\Studies\\one.graphbuilder.json', 'One')
    rememberProject('C:\\Studies\\two.graphbuilder.json', 'Two')
    rememberProject('C:\\Studies\\one.graphbuilder.json', 'One updated')
    expect(recentProjects()).toEqual([
      { path: 'C:\\Studies\\one.graphbuilder.json', name: 'One updated' },
      { path: 'C:\\Studies\\two.graphbuilder.json', name: 'Two' },
    ])
  })

  it('ignores damaged stored data', () => {
    localStorage.setItem('graph-builder-recent-projects', '{')
    expect(recentProjects()).toEqual([])
  })
})
