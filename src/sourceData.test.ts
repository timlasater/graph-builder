import { describe, expect, it } from 'vitest'
import { datasetSignature } from './datasetSignature'
import { sampleDataset } from './sampleData'
import { chooseSourceDataset, withFileSource } from './sourceData'

describe('linked project source data', () => {
  const compatibleSheet = { name: 'Results', dataset: sampleDataset }

  it('attaches the file and worksheet identity to an imported dataset', () => {
    expect(withFileSource(compatibleSheet, 'results.xlsx', 'handle-1').source).toEqual({ fileName: 'results.xlsx', sheetName: 'Results', handleId: 'handle-1', signature: datasetSignature(compatibleSheet.dataset) })
  })

  it('selects the original compatible worksheet from refreshed file contents', () => {
    const signature = datasetSignature(sampleDataset)
    const refreshed = chooseSourceDataset([{ name: 'Notes', dataset: { ...sampleDataset, columns: sampleDataset.columns.slice(1) } }, compatibleSheet], { fileName: 'results.xlsx', sheetName: 'Results', handleId: 'handle-1' }, signature)
    expect(refreshed?.name).toBe(sampleDataset.name)
    expect(refreshed?.source?.handleId).toBe('handle-1')
    expect(datasetSignature(refreshed!)).toBe(signature)
  })

  it('rejects refreshed data when no worksheet matches the saved schema', () => {
    const incompatible = { ...sampleDataset, columns: sampleDataset.columns.slice(1) }
    expect(chooseSourceDataset([{ name: 'Results', dataset: incompatible }], { fileName: 'results.xlsx', sheetName: 'Results' }, datasetSignature(sampleDataset))).toBeUndefined()
  })
})
