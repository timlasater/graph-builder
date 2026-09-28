import { datasetSignature } from './plotSetups'
import { parseProject, PROJECT_FORMAT, PROJECT_VERSION } from './projects'
import type { Dataset, GraphSpec, RowFilter } from './types'

export interface GraphTemplate {
  format: 'graphbuilder-template'
  version: 1
  name: string
  sourceSignature: string
  spec: GraphSpec
  filters: RowFilter[]
}

export const makeTemplate = (name: string, dataset: Dataset, spec: GraphSpec, filters: RowFilter[]): GraphTemplate => {
  if (!name.trim()) throw new Error('Enter a template name.')
  return { format: 'graphbuilder-template', version: 1, name: name.trim(), sourceSignature: datasetSignature(dataset), spec: structuredClone(spec), filters: structuredClone(filters) }
}

export const parseTemplate = (content: string): GraphTemplate => {
  let value: unknown
  try { value = JSON.parse(content) } catch { throw new Error('This is not valid template JSON.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This is not a Graph Builder template.')
  const candidate = value as Partial<GraphTemplate>
  if (candidate.format !== 'graphbuilder-template' || candidate.version !== 1 || typeof candidate.name !== 'string' || !candidate.name.trim() || typeof candidate.sourceSignature !== 'string') throw new Error('This is not a supported Graph Builder template.')
  parseProject(JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, name: candidate.name, savedAt: new Date().toISOString(), data: { mode: 'linked', source: { fileName: 'template-source', signature: candidate.sourceSignature } }, graphs: [{ id: 'template-graph', name: candidate.name, spec: candidate.spec, filters: candidate.filters }], activeGraphId: 'template-graph' }))
  return structuredClone(candidate) as GraphTemplate
}

export const templateFitsDataset = (template: GraphTemplate, dataset: Dataset) => template.sourceSignature === datasetSignature(dataset)
