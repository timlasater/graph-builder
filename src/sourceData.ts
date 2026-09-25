import { datasetSignature } from './plotSetups'
import type { ImportedSheet } from './importData'
import type { Dataset, DatasetSource } from './types'

export const withFileSource = (sheet: ImportedSheet, fileName: string, handleId?: string): Dataset => ({
  ...sheet.dataset,
  source: { fileName, sheetName: sheet.name, handleId },
})

export const chooseSetupDataset = (sheets: ImportedSheet[], source: Pick<DatasetSource, 'fileName' | 'sheetName' | 'handleId'>, expectedSignature: string) => {
  const preferred = source.sheetName ? sheets.find((sheet) => sheet.name === source.sheetName) : undefined
  const selected = preferred && datasetSignature(preferred.dataset) === expectedSignature
    ? preferred
    : sheets.find((sheet) => datasetSignature(sheet.dataset) === expectedSignature)
  return selected ? withFileSource(selected, source.fileName, source.handleId) : undefined
}
