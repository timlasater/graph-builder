import { describe, expect, it } from 'vitest'
import { defaultGraphSpec } from './store'
import { datasetSignature, makePlotSetup } from './plotSetups'
import { sampleDataset } from './sampleData'
import { chooseSetupDataset, withFileSource } from './sourceData'

describe('saved setup source data', () => {
  const compatibleSheet = { name: 'Results', dataset: sampleDataset }

  it('attaches the file and worksheet identity to an imported dataset', () => {
    expect(withFileSource(compatibleSheet, 'results.xlsx', 'handle-1').source).toEqual({ fileName: 'results.xlsx', sheetName: 'Results', handleId: 'handle-1' })
  })

  it('selects the original compatible worksheet from refreshed file contents', () => {
    const setup = makePlotSetup('Live results', withFileSource(compatibleSheet, 'results.xlsx', 'handle-1'), defaultGraphSpec(sampleDataset), [])
    const refreshed = chooseSetupDataset([{ name: 'Notes', dataset: { ...sampleDataset, columns: sampleDataset.columns.slice(1) } }, compatibleSheet], { fileName: 'results.xlsx', sheetName: setup.sourceSheetName, handleId: setup.sourceHandleId }, setup.sourceSignature)
    expect(refreshed?.name).toBe(sampleDataset.name)
    expect(refreshed?.source?.handleId).toBe('handle-1')
    expect(datasetSignature(refreshed!)).toBe(setup.sourceSignature)
  })

  it('rejects refreshed data when no worksheet matches the saved schema', () => {
    const incompatible = { ...sampleDataset, columns: sampleDataset.columns.slice(1) }
    expect(chooseSetupDataset([{ name: 'Results', dataset: incompatible }], { fileName: 'results.xlsx', sheetName: 'Results' }, datasetSignature(sampleDataset))).toBeUndefined()
  })
})
