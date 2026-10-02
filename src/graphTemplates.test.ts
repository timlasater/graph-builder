import { describe, expect, it } from 'vitest'
import { makeTemplate, parseTemplate, templateFitsDataset } from './graphTemplates'
import { sampleDataset } from './sampleData'
import { useBuilderStore } from './store'

describe('graph templates', () => {
  it('round-trips a data-free template for compatible columns', () => {
    const template = makeTemplate('Dose template', sampleDataset, useBuilderStore.getState().spec, [])
    expect(parseTemplate(JSON.stringify(template))).toEqual(template)
    expect(templateFitsDataset(template, sampleDataset)).toBe(true)
    expect(JSON.stringify(template)).not.toContain('Group A')
    expect(templateFitsDataset(template, { ...sampleDataset, columns: sampleDataset.columns.slice(1) })).toBe(false)
  })

  it('rejects a malformed template', () => {
    expect(() => parseTemplate('{')).toThrow('not valid')
    expect(() => parseTemplate(JSON.stringify({ format: 'graphbuilder-template', version: 1, name: 'Bad', sourceSignature: 'x', spec: {}, filters: [] }))).toThrow()
  })
})
