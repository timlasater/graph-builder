import { describe, expect, it } from 'vitest'
import { datasetFromMatrix } from './importData'
import { pairedSeries } from './pairedSeries'
import { useBuilderStore } from './store'

const spec = useBuilderStore.getState().spec

describe('pairedSeries', () => {
  it('connects each subject in category order while keeping original row IDs', () => {
    const dataset = datasetFromMatrix([
      ['Subject', 'Visit', 'Value'],
      ['B', 'After', 9], ['A', 'After', 7], ['A', 'Before', 4], ['B', 'Before', 5],
    ], 'Paired')
    const [id, x, y] = dataset.columns
    x.modelingType = 'ordinal'
    const result = pairedSeries(dataset.rows, x, y, id, { ...spec, categoryOrder: 'manual', manualCategories: ['Before', 'After'] })
    expect(result.warnings).toEqual([])
    expect(result.trajectories.map((item) => [item.subject, item.points.map((point) => point.y)])).toEqual([['B', [5, 9]], ['A', [4, 7]]])
    expect(result.trajectories[0].points.map((point) => point.rowId)).toEqual([dataset.rows[3].id, dataset.rows[0].id])
  })

  it('omits ambiguous subjects and missing IDs without averaging observations', () => {
    const dataset = datasetFromMatrix([
      ['Subject', 'Visit', 'Value'],
      ['A', 'Before', 2], ['A', 'Before', 4], ['A', 'After', 6],
      ['B', 'Before', 3], ['B', 'After', null], ['', 'After', 8],
    ], 'Paired')
    const [id, x, y] = dataset.columns
    x.modelingType = 'nominal'
    const result = pairedSeries(dataset.rows, x, y, id, spec)
    expect(result.trajectories).toEqual([{ subject: 'B', points: [{ x: 'Before', y: 3, rowId: dataset.rows[3].id }] }])
    expect(result.warnings.join(' ')).toContain('missing Subject ID')
    expect(result.warnings.join(' ')).toContain('repeated X categories')
  })
})
