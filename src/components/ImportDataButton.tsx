import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { persistentFilePickerAvailable, pickPersistentFile } from '../fileHandles'
import { chooseDesktopFile, desktopOpenKind, isDesktop, readDesktopFile } from '../desktopFiles'
import { importPreparedFile, prepareTabularFile, type PreparedTabularFile } from '../importData'
import { withFileSource } from '../sourceData'
import { useDialogFocus } from '../useDialogFocus'
import type { Dataset } from '../types'

interface PendingSheets {
  prepared: PreparedTabularFile
  handleId?: string
  nativePath?: string
}

interface OpenRequest { id: number; path: string }

export function ImportDataButton({ onImport, onProjectDrop, openRequest }: { onImport: (dataset: Dataset) => void; onProjectDrop: (file: File | string) => void; openRequest?: OpenRequest }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onImportRef = useRef(onImport)
  const onProjectDropRef = useRef(onProjectDrop)
  useEffect(() => { onImportRef.current = onImport; onProjectDropRef.current = onProjectDrop }, [onImport, onProjectDrop])
  const dragDepthRef = useRef(0)
  const processedOpenRequest = useRef<number | undefined>(undefined)
  const [pending, setPending] = useState<PendingSheets>()
  const [skipRows, setSkipRows] = useState(0)
  const [selectedSheet, setSelectedSheet] = useState('')
  const sheetDialogRef = useDialogFocus<HTMLElement>(Boolean(pending))
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [fileDragging, setFileDragging] = useState(false)
  const cancelImport = useCallback(() => { setPending(undefined); setError(undefined) }, [])

  useEffect(() => {
    if (!pending) return
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      cancelImport()
    }
    window.addEventListener('keydown', cancelOnEscape, true)
    return () => window.removeEventListener('keydown', cancelOnEscape, true)
  }, [pending, cancelImport])

  const readFile = useCallback(async (file?: File, handleId?: string, nativePath?: string) => {
    if (!file) return
    setBusy(true)
    setError(undefined)
    try {
      const prepared = await prepareTabularFile(file)
      setSkipRows(0)
      setSelectedSheet(prepared.sheets[0].name)
      setPending({ prepared, handleId, nativePath })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be imported.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [])

  useEffect(() => {
    if (!isDesktop()) return
    let active = true
    let unlisten: (() => void) | undefined
    void getCurrentWindow().onDragDropEvent((event) => {
      const payload = event.payload
      if (payload.type === 'enter') setFileDragging(payload.paths.length > 0)
      else if (payload.type === 'leave') setFileDragging(false)
      else if (payload.type === 'drop') {
        setFileDragging(false)
        const path = payload.paths[0]
        if (!path) return
        const kind = desktopOpenKind(path)
        if (kind === 'project') onProjectDropRef.current(path)
        else if (kind === 'data') void readDesktopFile(path).then((file) => readFile(file, undefined, path)).catch((reason) => setError(reason instanceof Error ? reason.message : 'The file could not be opened.'))
        else setError('Drop a CSV, TSV, TXT, XLSX, XLS, or Graph Builder project file.')
      }
    }).then((stop) => { if (active) unlisten = stop; else stop() }).catch((reason) => setError(reason instanceof Error ? reason.message : 'File dropping is unavailable.'))
    return () => { active = false; unlisten?.() }
  }, [readFile])

  useEffect(() => {
    if (!openRequest || processedOpenRequest.current === openRequest.id) return
    processedOpenRequest.current = openRequest.id
    void readDesktopFile(openRequest.path).then((file) => readFile(file, undefined, openRequest.path)).catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'The file could not be opened.')
    })
  }, [openRequest, readFile])

  useEffect(() => {
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')
    const dragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepthRef.current += 1
      setFileDragging(true)
    }
    const dragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const dragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setFileDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepthRef.current = 0
      setFileDragging(false)
      if (isDesktop()) return
      const file = event.dataTransfer?.files[0]
      if (!file) return
      if (desktopOpenKind(file.name) === 'project') onProjectDropRef.current(file)
      else void readFile(file)
    }
    window.addEventListener('dragenter', dragEnter)
    window.addEventListener('dragover', dragOver)
    window.addEventListener('dragleave', dragLeave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', dragEnter)
      window.removeEventListener('dragover', dragOver)
      window.removeEventListener('dragleave', dragLeave)
      window.removeEventListener('drop', drop)
    }
  }, [readFile])

  const chooseFile = async () => {
    if (isDesktop()) {
      setBusy(true); setError(undefined)
      try { const path = await chooseDesktopFile('data'); if (path) await readFile(await readDesktopFile(path), undefined, path) }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'The file could not be opened.') }
      finally { setBusy(false) }
      return
    }
    if (!persistentFilePickerAvailable()) { inputRef.current?.click(); return }
    setBusy(true)
    setError(undefined)
    try {
      const selected = await pickPersistentFile()
      if (selected) await readFile(selected.file, selected.handleId)
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'The file could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  const finishImport = () => {
    if (!pending) return
    try {
      const sheet = importPreparedFile(pending.prepared, skipRows, selectedSheet)[0]
      if (!sheet) throw new Error('Choose a worksheet to import.')
      onImport(withFileSource(sheet, pending.prepared.fileName, pending.handleId, pending.nativePath, skipRows))
      setPending(undefined)
      setError(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be imported.')
    }
  }

  return (
    <>
      <input ref={inputRef} className="visually-hidden" type="file" tabIndex={-1} aria-label="Choose a CSV or Excel data file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => void readFile(event.target.files?.[0])} />
      <button className="import-button" onClick={() => void chooseFile()} disabled={busy}>{busy ? 'Importing…' : 'Import data'}</button>
      {busy && <span role="status" className="visually-hidden">Reading and checking your data file. This may take a moment.</span>}
      {fileDragging && <div className="file-drop-overlay" role="status" aria-live="polite"><div><strong>Drop data or project file to open</strong><span>CSV, TSV, TXT, XLS, XLSX, or .graphbuilder</span></div></div>}
      {pending && (
        <div className="modal-backdrop" role="presentation">
          <section ref={sheetDialogRef} className="sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1}>
            <div className="sheet-dialog-header"><div><span className="eyebrow">{pending.prepared.kind === 'workbook' ? 'EXCEL WORKBOOK' : 'DATA FILE'}</span><h2 id="sheet-title">{pending.prepared.sheets.length > 1 ? 'Choose a worksheet' : 'Import data'}</h2></div><button type="button" className="dialog-close" aria-label="Close import data" onClick={cancelImport}>×</button></div>
            {pending.prepared.sheets.length > 1 && <div className="sheet-list" role="group" aria-label="Worksheets">{pending.prepared.sheets.map((sheet) => <label key={sheet.name}><input type="radio" name="import-sheet" checked={selectedSheet === sheet.name} onChange={() => setSelectedSheet(sheet.name)} /><strong>{sheet.name}</strong></label>)}</div>}
            <label className="import-skip-rows">Rows to skip before header<input type="number" min="0" step="1" value={skipRows} onChange={(event) => setSkipRows(event.target.value === '' ? 0 : Number(event.target.value))} /></label>
            <p className="import-header-preview">{(() => { const matrix = pending.prepared.sheets.find((sheet) => sheet.name === selectedSheet)?.matrix ?? []; const header = matrix.slice(Math.max(0, skipRows)).find((row) => row.some((value) => value !== null && value !== undefined && String(value).trim() !== '')); return header ? `Header row: ${header.map((value) => String(value ?? '')).join(' · ')}` : 'No header row remains. Choose a smaller number.' })()}</p>
            {pending.prepared.kind === 'workbook' && <p>Graph Annotations are applied automatically; tagged rows are not counted as measurements.</p>}
            {error && <p className="import-dialog-error" role="alert">{error}</p>}
            <button className="import-confirm" onClick={finishImport}>Import selected data</button>
            <button className="dialog-cancel" onClick={cancelImport}>Cancel</button>
          </section>
        </div>
      )}
      {error && !pending && <div className="import-error" role="alert"><span>{error}</span><button aria-label="Dismiss import error" onClick={() => setError(undefined)}>×</button></div>}
    </>
  )
}
