import { useEffect, useRef, useState } from 'react'
import { chooseDesktopFile, isDesktop, readDesktopFile } from '../desktopFiles'
import { datasetSignature } from '../datasetSignature'
import { importTabularFile } from '../importData'
import { rebuildLinkedDataset } from '../projects'
import { chooseSourceDataset } from '../sourceData'
import { useBuilderStore } from '../store'
import type { Dataset } from '../types'

export function RefreshLinkedSource({ initialRefresh = false }: { initialRefresh?: boolean }) {
  const linked = useBuilderStore((state) => state.projectMode === 'linked' && Boolean(state.dataset.source?.fileName))
  const input = useRef<HTMLInputElement>(null)
  const original = useRef<Dataset | undefined>(undefined)
  const inProgress = useRef(false)
  const started = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const finish = () => { inProgress.current = false; setBusy(false); original.current = undefined }
  const report = (error: unknown) => setMessage(`${error instanceof Error ? error.message : 'The source could not be refreshed.'} Your current data is unchanged.`)

  const load = async (file: File, nativePath?: string) => {
    const dataset = original.current
    if (!dataset?.source) return
    const source = { ...dataset.source, fileName: file.name, nativePath, handleId: undefined }
    const sheets = await importTabularFile(file, source.skipRows ?? 0)
    const signature = source.signature ?? datasetSignature({ columns: dataset.columns.filter((column) => !column.formula) })
    const selected = chooseSourceDataset(sheets, source, signature)
    if (!selected) throw new Error('The source columns no longer match this linked project. Choose a file with the original columns and data types.')
    const refreshed = rebuildLinkedDataset(selected, dataset.columns)
    const current = useBuilderStore.getState()
    if (current.dataset !== dataset || current.projectMode !== 'linked') throw new Error('The project changed while the source was being read. Try refreshing again.')
    current.refreshLinkedDataset(refreshed)
    setMessage(`Linked source refreshed: ${refreshed.rows.length} ${refreshed.rows.length === 1 ? 'row' : 'rows'}. All graphs use the updated data. Undo restores the previous data.`)
  }

  const refresh = async () => {
    const state = useBuilderStore.getState()
    if (inProgress.current || state.projectMode !== 'linked' || !state.dataset.source) return
    if (!window.confirm('Refresh from the linked source file? This replaces local cell edits and excluded rows with the latest source data for all graphs. Graph settings, filters, column settings, and formulas are kept. You can Undo after closing Projects & export.')) return
    original.current = state.dataset
    inProgress.current = true; setBusy(true); setMessage('')
    if (!isDesktop()) { input.current?.click(); return }
    try {
      const path = state.dataset.source.nativePath
      let file: File | undefined
      if (path) { try { file = await readDesktopFile(path) } catch { /* Ask for a moved or inaccessible source below. */ } }
      if (file) await load(file, path)
      else {
        const selectedPath = await chooseDesktopFile('source', path)
        if (!selectedPath) { setMessage('Refresh canceled. Your current data is unchanged.'); return }
        await load(await readDesktopFile(selectedPath), selectedPath)
      }
    } catch (error) { report(error) }
    finally { finish() }
  }

  useEffect(() => {
    if (initialRefresh && !started.current) { started.current = true; void refresh() }
  })
  useEffect(() => {
    const element = input.current
    const cancel = () => { setMessage('Refresh canceled. Your current data is unchanged.'); finish() }
    element?.addEventListener('cancel', cancel)
    return () => element?.removeEventListener('cancel', cancel)
  }, [linked])

  if (!linked) return null
  return <>
    <div className="project-actions"><button type="button" disabled={busy} onClick={() => void refresh()} title={isDesktop() ? 'Refresh linked source (Ctrl+Shift+R)' : 'Choose the latest source file'}>{busy ? 'Refreshing…' : 'Refresh linked source'}</button></div>
    <small className="setting-help">Reload source rows for all graphs; local cell edits and row exclusions are replaced. Graph settings, filters, and formulas stay. {isDesktop() ? 'Shortcut: Ctrl+Shift+R outside dialogs and text fields.' : 'Choose the source file again when asked.'}</small>
    {message && <p className="project-message" role="status">{message}</p>}
    <input ref={input} className="visually-hidden" type="file" tabIndex={-1} aria-label="Choose linked source to refresh" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) { finish(); return }
      void load(file).catch(report).finally(finish)
    }} />
  </>
}
