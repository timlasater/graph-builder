import { useDroppable } from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import { useBuilderStore } from '../store'
import type { CellValue, DataColumn, RowFilter } from '../types'

export function FilterDropZone({ activeCount, onEdit }: { activeCount: number; onEdit: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'filter-zone' })
  return <div ref={setNodeRef} role={activeCount ? 'button' : undefined} tabIndex={activeCount ? 0 : undefined} onClick={activeCount ? onEdit : undefined} onKeyDown={(event) => { if (activeCount && (event.key === 'Enter' || event.key === ' ')) onEdit() }} className={`drop-zone filter-drop-zone ${isOver ? 'over' : ''} ${activeCount ? 'filled' : ''}`} title={activeCount ? `${activeCount} active filter${activeCount === 1 ? '' : 's'} · click to edit` : undefined}>
    <span className="drop-label">FILTER</span><span className="drop-hint">{activeCount ? `${activeCount} active` : 'Drop variable'}</span>
  </div>
}

const sameValue = (left: CellValue, right: CellValue) => left === right
const labelFor = (column: DataColumn, value: CellValue) => value === null ? '(Missing)' : column.valueLabels?.[String(value)] ?? String(value)

export function FilterPopup({ column, onClose }: { column: DataColumn; onClose: () => void }) {
  const { dataset, filters, setFilters } = useBuilderStore()
  const existing = filters.find((filter) => filter.columnId === column.id)
  const uniqueValues = useMemo(() => [...new Set(dataset.rows.map((row) => row.values[column.id]))], [column.id, dataset.rows])
  const checklist = (column.dataType !== 'number' && column.dataType !== 'date') || column.modelingType === 'nominal' || (column.modelingType === 'ordinal' && uniqueValues.length <= 10)
  const [selected, setSelected] = useState<CellValue[]>(existing?.operator === 'in' ? existing.values ?? [] : uniqueValues)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'range' | 'missing' | 'present'>(existing?.operator === 'isMissing' ? 'missing' : existing?.operator === 'isNotMissing' ? 'present' : 'range')
  const [minimum, setMinimum] = useState(existing?.operator === 'between' && existing.min !== undefined ? String(existing.min) : '')
  const [maximum, setMaximum] = useState(existing?.operator === 'between' && existing.max !== undefined ? String(existing.max) : '')
  const [start, setStart] = useState(existing?.operator === 'dateBetween' ? existing.start ?? '' : '')
  const [end, setEnd] = useState(existing?.operator === 'dateBetween' ? existing.end ?? '' : '')
  const numericValues = uniqueValues.map(Number).filter(Number.isFinite)
  const visibleValues = uniqueValues.filter((value) => labelFor(column, value).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const replaceFilter = (filter?: RowFilter) => {
    const others = filters.filter((item) => item.columnId !== column.id)
    setFilters(filter ? [...others, filter] : others); onClose()
  }
  const apply = () => {
    if (!checklist && mode !== 'range') { replaceFilter({ id: existing?.id ?? crypto.randomUUID(), columnId: column.id, operator: mode === 'missing' ? 'isMissing' : 'isNotMissing' }); return }
    if (checklist) {
      if (selected.length === uniqueValues.length) replaceFilter()
      else replaceFilter({ id: existing?.id ?? crypto.randomUUID(), columnId: column.id, operator: 'in', values: selected })
    } else if (column.dataType === 'date') {
      if (!start && !end) replaceFilter()
      else replaceFilter({ id: existing?.id ?? crypto.randomUUID(), columnId: column.id, operator: 'dateBetween', start: start || undefined, end: end || undefined })
    } else {
      const min = minimum === '' ? undefined : Number(minimum); const max = maximum === '' ? undefined : Number(maximum)
      if (min === undefined && max === undefined) replaceFilter()
      else replaceFilter({ id: existing?.id ?? crypto.randomUUID(), columnId: column.id, operator: 'between', min, max })
    }
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); apply() }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  return <div className="modal-backdrop filter-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="filter-dialog" role="dialog" aria-modal="true" aria-labelledby="filter-title">
      <header><div><span className="eyebrow">FILTER</span><h2 id="filter-title">{column.name}</h2></div><button className="dialog-close" onClick={onClose} aria-label="Close filter">×</button></header>
      {checklist ? <><div className="filter-select-actions"><input className="filter-level-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search levels" aria-label="Search filter levels" /><button onClick={() => setSelected(uniqueValues)}>Select all</button><button onClick={() => setSelected([])}>Deselect all</button></div><div className="filter-checklist">{visibleValues.map((value, index) => <label key={`${String(value)}-${index}`}><input type="checkbox" checked={selected.some((item) => sameValue(item, value))} onChange={(event) => setSelected(event.target.checked ? [...selected, value] : selected.filter((item) => !sameValue(item, value)))} /><span>{labelFor(column, value)}</span><small>{dataset.rows.filter((row) => row.values[column.id] === value).length}</small></label>)}</div></> : <div className="filter-bounds"><label>Values<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="range">Inside bounds</option><option value="present">Non-missing only</option><option value="missing">Missing only</option></select></label>{mode === 'range' && (column.dataType === 'date' ? <><label>On or after<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>On or before<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label></> : <><p>Keep values inside either or both bounds.</p><label>Greater than or equal to<input type="number" value={minimum} placeholder={numericValues.length ? String(Math.min(...numericValues)) : ''} onChange={(event) => setMinimum(event.target.value)} /></label><label>Less than or equal to<input type="number" value={maximum} placeholder={numericValues.length ? String(Math.max(...numericValues)) : ''} onChange={(event) => setMaximum(event.target.value)} /></label></>)}</div>}
      <footer><button className="dialog-cancel" onClick={() => replaceFilter()}>Clear filter</button><span /><button className="dialog-cancel" onClick={onClose}>Cancel</button><button className="filter-apply" onClick={apply}>Apply filter</button></footer>
    </section>
  </div>
}

const filterSummary = (filter: RowFilter, column: DataColumn) => {
  if (filter.operator === 'in') return (filter.values ?? []).map((value) => labelFor(column, value)).join(', ') || 'No values selected'
  if (filter.operator === 'between') return `${filter.min ?? '−∞'} to ${filter.max ?? '∞'}`
  if (filter.operator === 'dateBetween') return `${filter.start ? new Date(filter.start).toLocaleString() : 'Any date'} to ${filter.end ? new Date(filter.end).toLocaleString() : 'Any date'}`
  if (filter.operator === 'isMissing') return 'Missing values'
  if (filter.operator === 'isNotMissing') return 'Non-missing values'
  return `${filter.operator} ${String(filter.value ?? '')}`
}

export function ActiveFiltersPopup({ onClose, onEdit }: { onClose: () => void; onEdit: (columnId: string) => void }) {
  const { dataset, filters, setFilters } = useBuilderStore()
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [onClose])
  return <div className="modal-backdrop filter-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="filter-dialog active-filters-dialog" role="dialog" aria-modal="true" aria-labelledby="active-filters-title">
      <header><div><span className="eyebrow">FILTERS</span><h2 id="active-filters-title">{filters.length} active filter{filters.length === 1 ? '' : 's'}</h2></div><button className="dialog-close" onClick={onClose} aria-label="Close active filters">×</button></header>
      <div className="active-filter-list">{filters.map((filter) => {
        const column = dataset.columns.find((item) => item.id === filter.columnId)
        if (!column) return null
        return <article key={filter.id}><div><strong>{column.name}</strong><span>{filterSummary(filter, column)}</span></div><button onClick={() => onEdit(column.id)}>Edit</button><button aria-label={`Remove ${column.name} filter`} onClick={() => setFilters(filters.filter((item) => item.id !== filter.id))}>Remove</button></article>
      })}</div>
      <p className="active-filter-help">Drag another variable to the Filter box to add or replace its filter.</p>
      <footer><span /><span /><button className="dialog-cancel" onClick={() => setFilters([])}>Clear all</button><button className="filter-apply" onClick={onClose}>Done</button></footer>
    </section>
  </div>
}
