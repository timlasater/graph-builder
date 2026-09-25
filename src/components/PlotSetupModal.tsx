import { useEffect, useState } from 'react'
import { datasetSignature, isSetupCompatible, makePlotSetup, readPlotSetups, writePlotSetups, type SavedPlotSetup } from '../plotSetups'
import { useBuilderStore } from '../store'

export function PlotSetupModal({ onClose }: { onClose: () => void }) {
  const { dataset, spec, filters, applyPlotSetup } = useBuilderStore()
  const [setups, setSetups] = useState<SavedPlotSetup[]>(() => readPlotSetups())
  const [name, setName] = useState(spec.title || 'Plot setup')
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const saveCurrent = () => {
    try {
      const sourceSignature = datasetSignature(dataset)
      const previous = setups.find((setup) => setup.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase() && setup.sourceSignature === sourceSignature)
      const saved = makePlotSetup(name, dataset, spec, filters, previous)
      const next = [saved, ...setups.filter((setup) => setup.id !== saved.id)]
      writePlotSetups(next); setSetups(next); setName(saved.name); setMessage(previous ? 'Setup updated.' : 'Setup saved locally.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The setup could not be saved.')
    }
  }

  const load = (setup: SavedPlotSetup) => {
    if (!isSetupCompatible(setup, dataset)) { setMessage(`Import “${setup.sourceName}” or another file with the same columns first.`); return }
    applyPlotSetup(setup.spec, setup.filters)
    onClose()
  }

  const remove = (id: string) => {
    try {
      const next = setups.filter((setup) => setup.id !== id)
      writePlotSetups(next); setSetups(next); setMessage('Saved setup removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The setup could not be removed.')
    }
  }

  return <div className="modal-backdrop plot-setup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="plot-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="plot-setup-title">
      <header><div><span className="eyebrow">LOCAL SETUPS</span><h2 id="plot-setup-title">Plot setups</h2><p>Save graph roles, layers, formatting, legend choices, and filters without copying the source data.</p></div><button className="dialog-close" aria-label="Close plot setups" onClick={onClose}>×</button></header>
      <form className="plot-setup-save" onSubmit={(event) => { event.preventDefault(); saveCurrent() }}>
        <label>Setup name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div><small>Source: {dataset.name} · {dataset.columns.length} columns</small><button type="submit">Save current setup</button></div>
      </form>
      {message && <p className="plot-setup-message" role="status">{message}</p>}
      <div className="plot-setup-list">
        {!setups.length && <div className="plot-setup-empty"><strong>No saved setups yet</strong><span>Save the current graph to reuse it after importing this data source again.</span></div>}
        {setups.map((setup) => { const compatible = isSetupCompatible(setup, dataset); return <article key={setup.id}>
          <div><strong>{setup.name}</strong><span>{setup.sourceName} · saved {new Date(setup.updatedAt).toLocaleString()}</span><small className={compatible ? 'compatible' : ''}>{compatible ? 'Ready for the current data' : 'Import the matching source data to load'}</small></div>
          <button disabled={!compatible} onClick={() => load(setup)}>Load</button>
          <button className="setup-remove" aria-label={`Remove ${setup.name}`} title={`Remove ${setup.name}`} onClick={() => remove(setup.id)}>×</button>
        </article> })}
      </div>
      <p className="plot-setup-help">Browser security prevents silently reopening a local file. Import the same file first; compatible setups become available immediately.</p>
    </section>
  </div>
}
