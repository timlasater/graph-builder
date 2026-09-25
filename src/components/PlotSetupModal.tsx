import { useEffect, useRef, useState } from 'react'
import { fileFromSavedHandle, persistentFilePickerAvailable, pickPersistentFile } from '../fileHandles'
import { importTabularFile } from '../importData'
import { datasetSignature, isSetupCompatible, makePlotSetup, readPlotSetups, writePlotSetups, type SavedPlotSetup } from '../plotSetups'
import { chooseSetupDataset } from '../sourceData'
import { useBuilderStore } from '../store'

export function PlotSetupModal({ onClose }: { onClose: () => void }) {
  const { dataset, spec, filters, applyPlotSetup } = useBuilderStore()
  const reconnectInputRef = useRef<HTMLInputElement>(null)
  const [setups, setSetups] = useState<SavedPlotSetup[]>(() => readPlotSetups())
  const [name, setName] = useState(spec.title || 'Plot setup')
  const [message, setMessage] = useState<string>()
  const [busyId, setBusyId] = useState<string>()
  const [reconnecting, setReconnecting] = useState<SavedPlotSetup>()

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

  const openSource = async (setup: SavedPlotSetup, file: File, handleId?: string) => {
    const sheets = await importTabularFile(file)
    const refreshed = chooseSetupDataset(sheets, { fileName: file.name, sheetName: setup.sourceSheetName, handleId }, setup.sourceSignature)
    if (!refreshed) throw new Error('No worksheet in this file matches the columns saved with this setup.')
    const updated = { ...setup, sourceName: refreshed.name, sourceFileName: file.name, sourceSheetName: refreshed.source?.sheetName, sourceHandleId: handleId, updatedAt: new Date().toISOString() }
    const next = setups.map((item) => item.id === setup.id ? updated : item)
    writePlotSetups(next); setSetups(next)
    applyPlotSetup(updated.spec, updated.filters, refreshed)
    onClose()
  }

  const load = async (setup: SavedPlotSetup) => {
    setBusyId(setup.id); setMessage(undefined)
    try {
      if (setup.sourceHandleId) {
        const file = await fileFromSavedHandle(setup.sourceHandleId)
        if (!file) { setMessage(`Access to “${setup.sourceFileName ?? setup.sourceName}” is unavailable. Use Reconnect source.`); return }
        await openSource(setup, file, setup.sourceHandleId)
        return
      }
      if (!isSetupCompatible(setup, dataset)) { setMessage(`Reconnect “${setup.sourceFileName ?? setup.sourceName}” to load its latest data.`); return }
      applyPlotSetup(setup.spec, setup.filters)
      onClose()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The source file could not be reopened.')
    } finally {
      setBusyId(undefined)
    }
  }

  const reconnect = async (setup: SavedPlotSetup) => {
    if (!persistentFilePickerAvailable()) { setReconnecting(setup); reconnectInputRef.current?.click(); return }
    setBusyId(setup.id); setMessage(undefined)
    try {
      const selected = await pickPersistentFile(setup.sourceHandleId)
      if (selected) await openSource(setup, selected.file, selected.handleId)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(error instanceof Error ? error.message : 'The source file could not be reconnected.')
    } finally {
      setBusyId(undefined)
    }
  }

  const reconnectFallback = async (file?: File) => {
    const setup = reconnecting
    setReconnecting(undefined)
    if (!setup || !file) return
    setBusyId(setup.id); setMessage(undefined)
    try { await openSource(setup, file) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The source file could not be reconnected.') }
    finally { setBusyId(undefined); if (reconnectInputRef.current) reconnectInputRef.current.value = '' }
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
      <header><div><span className="eyebrow">LOCAL SETUPS</span><h2 id="plot-setup-title">Plot setups</h2><p>Save graph roles, layers, formatting, legend choices, filters, and a reusable connection to the source file.</p></div><button className="dialog-close" aria-label="Close plot setups" onClick={onClose}>×</button></header>
      <form className="plot-setup-save" onSubmit={(event) => { event.preventDefault(); saveCurrent() }}>
        <label>Setup name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div><small>Source: {dataset.source?.fileName ?? dataset.name} · {dataset.columns.length} columns</small><button type="submit">Save current setup</button></div>
      </form>
      <input ref={reconnectInputRef} className="visually-hidden" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => void reconnectFallback(event.target.files?.[0])} />
      {message && <p className="plot-setup-message" role="status">{message}</p>}
      <div className="plot-setup-list">
        {!setups.length && <div className="plot-setup-empty"><strong>No saved setups yet</strong><span>Import a file, configure the graph, and save it here to reopen the latest file contents later.</span></div>}
        {setups.map((setup) => { const compatible = isSetupCompatible(setup, dataset); const busy = busyId === setup.id; return <article key={setup.id}>
          <div><strong>{setup.name}</strong><span>{setup.sourceFileName ?? setup.sourceName}{setup.sourceSheetName ? ` · ${setup.sourceSheetName}` : ''} · saved {new Date(setup.updatedAt).toLocaleString()}</span><small className={setup.sourceHandleId || compatible ? 'compatible' : ''}>{setup.sourceHandleId ? 'Linked source · opens the latest data' : compatible ? 'Ready with the current data' : 'Reconnect the source file to load'}</small></div>
          <button disabled={busy} onClick={() => void (setup.sourceHandleId || compatible ? load(setup) : reconnect(setup))}>{busy ? 'Opening…' : setup.sourceHandleId ? 'Open latest' : compatible ? 'Load current' : 'Reconnect source'}</button>
          <button className="setup-reconnect" disabled={busy} onClick={() => void reconnect(setup)}>Reconnect</button>
          <button className="setup-remove" aria-label={`Remove ${setup.name}`} title={`Remove ${setup.name}`} onClick={() => remove(setup.id)}>×</button>
        </article> })}
      </div>
      <p className="plot-setup-help">Your browser may ask you to approve file access again. If the file moves or permission expires, use Reconnect source.</p>
    </section>
  </div>
}
