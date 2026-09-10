import { useRef, useState } from 'react'
import { importTabularFile, type ImportedSheet } from '../importData'
import type { Dataset } from '../types'

export function ImportDataButton({ onImport }: { onImport: (dataset: Dataset) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [sheets, setSheets] = useState<ImportedSheet[]>([])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const readFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setError(undefined)
    try {
      const imported = await importTabularFile(file)
      if (imported.length === 1) onImport(imported[0].dataset)
      else setSheets(imported)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The file could not be imported.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => void readFile(event.target.files?.[0])} />
      <button className="import-button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? 'Importing…' : 'Import data'}</button>
      {sheets.length > 0 && (
        <div className="modal-backdrop" role="presentation">
          <section className="sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <span className="eyebrow">EXCEL WORKBOOK</span>
            <h2 id="sheet-title">Choose a worksheet</h2>
            <p>Select the sheet you want to graph. You can import another sheet later.</p>
            <div className="sheet-list">
              {sheets.map((sheet) => <button key={sheet.name} onClick={() => { onImport(sheet.dataset); setSheets([]) }}><strong>{sheet.name}</strong><span>{sheet.dataset.rows.length} rows · {sheet.dataset.columns.length} columns</span></button>)}
            </div>
            <button className="dialog-cancel" onClick={() => setSheets([])}>Cancel</button>
          </section>
        </div>
      )}
      {error && <div className="import-error" role="alert"><span>{error}</span><button onClick={() => setError(undefined)}>×</button></div>}
    </>
  )
}
