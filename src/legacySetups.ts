import { parseTemplate, type GraphTemplate } from './graphTemplates'

const STORAGE_KEY = 'graph-builder.plot-setups.v1'

// Old browser-saved setups remain in local storage. Offer a settings-only
// template download in Projects so removing the old screen does not strand them.
export const readLegacyTemplates = (storage: Storage = window.localStorage): GraphTemplate[] => {
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(saved)) return []
    return saved.flatMap((value) => {
      if (!value || typeof value !== 'object') return []
      const setup = value as Record<string, unknown>
      if (setup.version !== 1 || typeof setup.name !== 'string' || typeof setup.sourceSignature !== 'string') return []
      try {
        return [parseTemplate(JSON.stringify({ format: 'graphbuilder-template', version: 1, name: setup.name, sourceSignature: setup.sourceSignature, spec: setup.spec, filters: setup.filters }))]
      } catch { return [] }
    })
  } catch { return [] }
}
