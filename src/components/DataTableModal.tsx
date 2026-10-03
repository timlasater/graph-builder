import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type CellValueChangedEvent, type ColDef, type GridApi, type GridReadyEvent, type RowClickedEvent } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { rowMatchesFilters, useBuilderStore } from '../store'
import { useDialogFocus } from '../useDialogFocus'
import type { CellValue, RowFilter } from '../types'

ModuleRegistry.registerModules([AllCommunityModule])
interface GridRow { __id: string; __excluded: boolean; [columnId: string]: CellValue | string | boolean }

export function DataTableModal({ onClose, openQuality = false }: { onClose: () => void; openQuality?: boolean }) {
  const { dataset, filters, selectedRowIds, setSelectedRowIds, clearRowSelection, updateCell, setRowExcluded, setRowsExcluded, setFilters, addCalculatedColumn, appendRows } = useBuilderStore()
  const selectedSet = new Set(selectedRowIds)
  const [formulaName, setFormulaName] = useState(''); const [formula, setFormula] = useState(''); const [paste, setPaste] = useState(''); const [message, setMessage] = useState<string>()
  const gridApiRef = useRef<GridApi<GridRow> | null>(null)
  const qualityRef = useRef<HTMLDetailsElement>(null)
  const dialogRef = useDialogFocus<HTMLElement>()
  const selectionAnchorRef = useRef<string | undefined>(undefined)
  const inputColumnCount = dataset.columns.filter((column) => !column.formula).length
  const activeRows = useMemo(() => dataset.rows.filter((row) => rowMatchesFilters(row, filters)), [dataset.rows, filters])
  const rows = useMemo<GridRow[]>(() => activeRows.map((row) => ({ __id: row.id, __excluded: row.excluded, ...row.values })), [activeRows])
  const columns = useMemo<ColDef<GridRow>[]>(() => [{ field: '__excluded', headerName: 'Include in graph', width: 130, pinned: 'left', filter: false,
    cellRenderer: ({ data, node }: { data?: GridRow; node: { rowIndex: number | null } }) => data && <input type="checkbox" aria-label={`Include row ${(node.rowIndex ?? 0) + 1} in graph`} checked={!data.__excluded} onClick={(event) => event.stopPropagation()} onChange={(event) => setRowExcluded(data.__id, !event.target.checked)} />,
  }, ...dataset.columns.map((column): ColDef<GridRow> => ({
    field: column.id, headerName: `${column.name}${column.formula ? ' ƒx' : ''}`, editable: !column.formula, sortable: true, filter: false, minWidth: 130, flex: 1,
    valueFormatter: ({ value }) => value === null ? '' : column.valueLabels?.[String(value)] ?? (column.dataType === 'date' ? new Date(String(value)).toLocaleString() : String(value)),
  }))], [dataset.columns, setRowExcluded])
  const cellChanged = (event: CellValueChangedEvent<GridRow>) => { if (event.data && event.colDef.field && event.colDef.field !== '__excluded') updateCell(event.data.__id, event.colDef.field, event.newValue as CellValue) }
  const safely = (action: () => void) => { try { action(); setMessage(undefined) } catch (error) { setMessage(error instanceof Error ? error.message : 'The operation failed.') } }
  const addFilter = () => dataset.columns[0] && setFilters([...filters, { id: crypto.randomUUID(), columnId: dataset.columns[0].id, operator: 'equals', value: '' }])
  const updateFilter = (id: string, patch: Partial<RowFilter>) => setFilters(filters.map((item) => item.id === id ? { ...item, ...patch } : item))
  const revealFirstSelectedRow = useCallback((api = gridApiRef.current) => {
    if (!api || !selectedRowIds.length) return
    const rowIndex = rows.findIndex((row) => row.__id === selectedRowIds[0])
    if (rowIndex < 0) return
    const pageSize = api.paginationGetPageSize()
    api.paginationGoToPage(Math.floor(rowIndex / pageSize))
    requestAnimationFrame(() => api.ensureIndexVisible(rowIndex, 'middle'))
  }, [rows, selectedRowIds])
  useEffect(() => { revealFirstSelectedRow() }, [revealFirstSelectedRow])
  useEffect(() => { if (openQuality && qualityRef.current) qualityRef.current.open = true }, [openQuality])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const rowClicked = (event: RowClickedEvent<GridRow>) => {
    if (!event.data) return
    const sourceEvent = event.event as MouseEvent | undefined
    const rowId = event.data.__id
    if (sourceEvent?.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = event.api.getRowNode(selectionAnchorRef.current)?.rowIndex
      const clickedIndex = event.node.rowIndex
      if (anchorIndex !== null && anchorIndex !== undefined && clickedIndex !== null) {
        const start = Math.min(anchorIndex, clickedIndex); const end = Math.max(anchorIndex, clickedIndex)
        const rangeIds = Array.from({ length: end - start + 1 }, (_, offset) => event.api.getDisplayedRowAtIndex(start + offset)?.data?.__id).filter((id): id is string => Boolean(id))
        setSelectedRowIds(rangeIds)
        return
      }
    }
    selectionAnchorRef.current = rowId
    if (sourceEvent?.ctrlKey || sourceEvent?.metaKey) setSelectedRowIds(selectedSet.has(rowId) ? selectedRowIds.filter((id) => id !== rowId) : [...selectedRowIds, rowId])
    else setSelectedRowIds([rowId])
  }

  return <div className="modal-backdrop data-modal-backdrop" role="presentation"><section ref={dialogRef} className="data-dialog" role="dialog" aria-modal="true" aria-labelledby="data-table-title" tabIndex={-1}>
    <header><div><span className="eyebrow">DATA TABLE</span><h2 id="data-table-title">{dataset.name}</h2><p>{activeRows.length} of {dataset.rows.length} rows · {dataset.columns.length} columns · Double-click a cell to edit</p></div><button className="dialog-close" onClick={onClose} aria-label="Close data table">×</button></header>
    <div className="data-tools">
      <details ref={qualityRef}><summary>Quality {dataset.warnings.length ? `(${dataset.warnings.length})` : '✓'}</summary><div className="tool-popover quality-list"><strong>Missing values</strong>{dataset.columns.map((column) => <span key={column.id}>{column.name}: {dataset.rows.filter((row) => row.values[column.id] === null).length}</span>)}{dataset.warnings.map((warning, index) => <span className="warning" key={index}>⚠ {warning.message}</span>)}</div></details>
      <details><summary>Filters ({filters.length})</summary><div className="tool-popover filter-list">{filters.map((filter) => <div key={filter.id}><select value={filter.columnId} onChange={(event) => updateFilter(filter.id, { columnId: event.target.value })}>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select><select value={filter.operator} onChange={(event) => updateFilter(filter.id, { operator: event.target.value as RowFilter['operator'] })}><option value="equals">equals</option><option value="notEquals">does not equal</option><option value="contains">contains</option><option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option><option value="isMissing">is missing</option><option value="isNotMissing">is not missing</option><option value="in">checklist</option><option value="between">numeric range</option><option value="dateBetween">date range</option></select>{filter.operator === 'in' ? <span>{filter.values?.length ?? 0} selected</span> : filter.operator === 'between' ? <span>{filter.min ?? '−∞'} to {filter.max ?? '∞'}</span> : filter.operator === 'dateBetween' ? <span>{filter.start ?? 'Any'} to {filter.end ?? 'Any'}</span> : !filter.operator.startsWith('is') && <input value={String(filter.value ?? '')} onChange={(event) => updateFilter(filter.id, { value: event.target.value })} />}<button onClick={() => setFilters(filters.filter((item) => item.id !== filter.id))}>×</button></div>)}<button onClick={addFilter}>+ Add filter</button></div></details>
      <details><summary>Calculated column</summary><div className="tool-popover formula-tool"><input placeholder="Column name" value={formulaName} onChange={(event) => setFormulaName(event.target.value)} /><input placeholder="e.g. [dose] / [pressure]" value={formula} onChange={(event) => setFormula(event.target.value)} /><small>Use [column ID or name], arithmetic, abs, sqrt, log, exp, min, max, and if.</small><button onClick={() => safely(() => { addCalculatedColumn(formulaName, formula); setFormulaName(''); setFormula('') })}>Add column</button></div></details>
      <details><summary>Paste Excel data</summary><div className="tool-popover paste-tool"><textarea placeholder={`Paste ${inputColumnCount} non-calculated tab-separated columns; one row per line`} value={paste} onChange={(event) => setPaste(event.target.value)} /><button onClick={() => safely(() => { appendRows(paste.trim().split(/\r?\n/).map((line) => line.split('\t'))); setPaste('') })}>Append rows</button></div></details>
      <button onClick={() => setRowsExcluded(activeRows.map((row) => row.id), true)}>Exclude visible rows</button>
      <button disabled={!selectedRowIds.length} onClick={() => setRowsExcluded(selectedRowIds, true)}>Exclude selected ({selectedRowIds.length})</button>
      <button disabled={!selectedRowIds.length} onClick={() => setRowsExcluded(selectedRowIds, false)}>Include selected</button>
      <button disabled={!selectedRowIds.length} onClick={clearRowSelection}>Clear selection</button>
    </div>
    {message && <div className="data-message" role="alert">{message}</div>}
    <div className="ag-theme-quartz data-grid"><AgGridReact<GridRow> theme="legacy" rowData={rows} columnDefs={columns} onGridReady={(event: GridReadyEvent<GridRow>) => { gridApiRef.current = event.api; revealFirstSelectedRow(event.api) }} onCellValueChanged={cellChanged} onRowClicked={rowClicked} rowClassRules={{ 'linked-row-selected': ({ data }) => Boolean(data && selectedSet.has(data.__id)) }} getRowId={({ data }) => data.__id} pagination paginationPageSize={100} paginationPageSizeSelector={[50, 100, 250]} animateRows={false} /></div>
  </section></div>
}
