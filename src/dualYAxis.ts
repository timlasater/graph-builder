import type { Dataset, GraphSpec } from './types'

const supportedLayers = new Set(['points', 'line', 'area', 'summary', 'fit', 'smooth'])

export const canUseDualYAxis = (spec: GraphSpec, dataset: Dataset) =>
  spec.x.length === 1 && spec.y.length === 2 && spec.y[0] !== spec.y[1] && !spec.groupX && !spec.groupY && !spec.wrap && !spec.panels?.length &&
  spec.layers.every((layer) => supportedLayers.has(layer.element) && !layer.x && !layer.y) &&
  spec.y.every((id) => dataset.columns.some((column) => column.id === id && column.dataType === 'number' && column.modelingType === 'continuous'))
