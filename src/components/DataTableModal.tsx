import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type CellValueChangedEvent, type ColDef } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { useBuilderStore } from '../store'
import type { CellValue } from '../types'

ModuleRegistry.registerModules([AllCommunityModule])

interface GridRow {
  __id: string
  __excluded: boolean
  [columnId: string]: CellValue | string | boolean
}

export function DataTableModal({ onClose }: { onClose: () => void }) {
  const { dataset, updateCell, setRowExcluded } = useBuilderStore()
  const rows = useMemo<GridRow[]>(() => dataset.rows.map((row) => ({ __id: row.id, __excluded: row.excluded, ...row.values })), [dataset.rows])
  const columns = useMemo<ColDef<GridRow>[]>(() => [
    {
      field: '__excluded', headerName: 'Excluded', width: 94, pinned: 'left', editable: true,
      cellDataType: 'boolean', filter: false,
    },
    ...dataset.columns.map((column): ColDef<GridRow> => ({
      field: column.id,
      headerName: column.name,
      editable: true,
      sortable: true,
      filter: true,
      minWidth: 130,
      flex: 1,
      valueFormatter: column.dataType === 'date' ? ({ value }) => value ? new Date(String(value)).toLocaleString() : '' : undefined,
    })),
  ], [dataset.columns])

  const cellChanged = (event: CellValueChangedEvent<GridRow>) => {
    if (!event.data || !event.colDef.field) return
    if (event.colDef.field === '__excluded') setRowExcluded(event.data.__id, Boolean(event.newValue))
    else updateCell(event.data.__id, event.colDef.field, event.newValue as CellValue)
  }

  return (
    <div className="modal-backdrop data-modal-backdrop" role="presentation">
      <section className="data-dialog" role="dialog" aria-modal="true" aria-labelledby="data-table-title">
        <header>
          <div><span className="eyebrow">DATA TABLE</span><h2 id="data-table-title">{dataset.name}</h2><p>{dataset.rows.length} rows · {dataset.columns.length} columns · Double-click a cell to edit</p></div>
          <button className="dialog-close" onClick={onClose} aria-label="Close data table">×</button>
        </header>
        <div className="ag-theme-quartz data-grid">
          <AgGridReact<GridRow>
            rowData={rows}
            columnDefs={columns}
            onCellValueChanged={cellChanged}
            getRowId={({ data }) => data.__id}
            pagination
            paginationPageSize={100}
            paginationPageSizeSelector={[50, 100, 250]}
            animateRows={false}
          />
        </div>
      </section>
    </div>
  )
}
