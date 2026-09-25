import { useRef, useState } from 'react'
import { persistentFilePickerAvailable, pickPersistentFile } from '../fileHandles'
import { importTabularFile, type ImportedSheet } from '../importData'
import { withFileSource } from '../sourceData'
import type { Dataset } from '../types'

interface PendingSheets {
  sheets: ImportedSheet[]
  fileName: string
  handleId?: string
}

export function ImportDataButton({ onImport }: { onImport: (dataset: Dataset) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingSheets>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const readFile = async (file?: File, handleId?: string) => {
    if (!file) return
    setBusy(true)
    setError(undefined)
    try {
      const imported = await importTabularFile(file)
      if (imported.length === 1) onImport(withFileSource(imported[0], file.name, handleId))
      else setPending({ sheets: imported, fileName: file.name, handleId })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be imported.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const chooseFile = async () => {
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
      <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => void readFile(event.target.files?.[0])} />
      <button className="import-button" onClick={() => void chooseFile()} disabled={busy}>{busy ? 'Importing…' : 'Import data'}</button>
      {pending && (
        <div className="modal-backdrop" role="presentation">
          <section className="sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <span className="eyebrow">EXCEL WORKBOOK</span>
            <h2 id="sheet-title">Choose a worksheet</h2>
            <p>Select the sheet you want to graph. You can import another sheet later.</p>
            <div className="sheet-list">
              {pending.sheets.map((sheet) => <button key={sheet.name} onClick={() => { onImport(withFileSource(sheet, pending.fileName, pending.handleId)); setPending(undefined) }}><strong>{sheet.name}</strong><span>{sheet.dataset.rows.length} rows · {sheet.dataset.columns.length} columns</span></button>)}
            </div>
            <button className="dialog-cancel" onClick={() => setPending(undefined)}>Cancel</button>
          </section>
        </div>
      )}
      {error && <div className="import-error" role="alert"><span>{error}</span><button onClick={() => setError(undefined)}>×</button></div>}
    </>
  )
}
