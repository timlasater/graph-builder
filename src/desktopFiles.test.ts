// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { desktopOpenKind, recentProjects, rememberProject } from './desktopFiles'

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

  it('removes existing repeats with different slash and letter casing', () => {
    localStorage.setItem('graph-builder-recent-projects', JSON.stringify([
      { path: 'C:\\Studies\\one.graphbuilder', name: 'One latest' },
      { path: 'c:/studies/ONE.graphbuilder', name: 'One old' },
      { path: 'C:\\Other\\one.graphbuilder', name: 'Another file with the same name' },
    ]))
    expect(recentProjects()).toEqual([
      { path: 'C:\\Studies\\one.graphbuilder', name: 'One latest' },
      { path: 'C:\\Other\\one.graphbuilder', name: 'Another file with the same name' },
    ])
    rememberProject('c:/studies/ONE.graphbuilder', 'One newest')
    expect(recentProjects()).toHaveLength(2)
    expect(recentProjects()[0].name).toBe('One newest')
  })
})

describe('desktop open-file routing', () => {
  it('recognizes supported data and project files without case sensitivity', () => {
    expect(desktopOpenKind('C:\\Studies\\RESULTS.XLSX')).toBe('data')
    expect(desktopOpenKind('C:\\Studies\\results.csv')).toBe('data')
    expect(desktopOpenKind('C:\\Studies\\chart.GRAPHBUILDER')).toBe('project')
    expect(desktopOpenKind('C:\\Studies\\old.graphbuilder.json')).toBe('project')
    expect(desktopOpenKind('C:\\Studies\\notes.pdf')).toBeUndefined()
  })
})
