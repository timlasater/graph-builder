import type { Dataset } from './types'

export const datasetSignature = (dataset: Pick<Dataset, 'columns'>) => JSON.stringify(dataset.columns.map((column) => [column.id, column.dataType, column.modelingType]))
