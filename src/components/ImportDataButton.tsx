import { useCallback, useEffect, useRef, useState } from 'react'
import { persistentFilePickerAvailable, pickPersistentFile } from '../fileHandles'
import { chooseDesktopFile, isDesktop, readDesktopFile } from '../desktopFiles'
import { importTabularFile, type ImportedSheet } from '../importData'
import { withFileSource } from '../sourceData'
import { useDialogFocus } from '../useDialogFocus'
import type { Dataset } from '../types'

interface PendingSheets {
  sheets: ImportedSheet[]
  fileName: string
  handleId?: string
  nativePath?: string
}

export function ImportDataButton({ onImport }: { onImport: (dataset: Dataset) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const [pending, setPending] = useState<PendingSheets>()
  const sheetDialogRef = useDialogFocus<HTMLElement>(Boolean(pending))
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [fileDragging, setFileDragging] = useState(false)

  const readFile = useCallback(async (file?: File, handleId?: string, nativePath?: string) => {
    if (!file) return
    setBusy(true)
    setError(undefined)
    try {
      const imported = await importTabularFile(file)
      if (imported.length === 1) onImport(withFileSource(imported[0], file.name, handleId, nativePath))
      else setPending({ sheets: imported, fileName: file.name, handleId, nativePath })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be imported.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [onImport])

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
      void readFile(event.dataTransfer?.files[0])
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

  return (
    <>
      <input ref={inputRef} className="visually-hidden" type="file" tabIndex={-1} aria-label="Choose a CSV or Excel data file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => void readFile(event.target.files?.[0])} />
      <button className="import-button" onClick={() => void chooseFile()} disabled={busy}>{busy ? 'Importing…' : 'Import data'}</button>
      {busy && <span role="status" className="visually-hidden">Reading and checking your data file. This may take a moment.</span>}
      {fileDragging && <div className="file-drop-overlay" role="status" aria-live="polite"><div><strong>Drop data file to import</strong><span>CSV, TSV, TXT, XLSX, or XLS</span></div></div>}
      {pending && (
        <div className="modal-backdrop" role="presentation">
          <section ref={sheetDialogRef} className="sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1}>
            <span className="eyebrow">EXCEL WORKBOOK</span>
            <h2 id="sheet-title">Choose a worksheet</h2>
            <p>Select the sheet you want to graph. Graph Annotations are applied automatically; tagged rows are not counted as measurements.</p>
            <div className="sheet-list">
              {pending.sheets.map((sheet) => <button key={sheet.name} onClick={() => { onImport(withFileSource(sheet, pending.fileName, pending.handleId, pending.nativePath)); setPending(undefined) }}><strong>{sheet.name}</strong><span>{sheet.dataset.rows.length} rows · {sheet.dataset.columns.length} columns · {(sheet.dataset.importedAnnotations?.referenceLines.length ?? 0) + (sheet.dataset.importedAnnotations?.referenceRegions.length ?? 0)} annotations</span></button>)}
            </div>
            <button className="dialog-cancel" onClick={() => setPending(undefined)}>Cancel</button>
          </section>
        </div>
      )}
      {error && <div className="import-error" role="alert"><span>{error}</span><button aria-label="Dismiss import error" onClick={() => setError(undefined)}>×</button></div>}
    </>
  )
}
