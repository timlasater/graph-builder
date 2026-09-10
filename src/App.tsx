import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useState, type ReactNode } from 'react'
import { DataTableModal } from './components/DataTableModal'
import { DropZone } from './components/DropZone'
import { GraphCanvas } from './components/GraphCanvas'
import { ImportDataButton } from './components/ImportDataButton'
import { VariableCard } from './components/VariableCard'
import { useBuilderStore } from './store'
import type { GraphElement, GraphRole } from './types'
import './App.css'

const graphElements: { id: GraphElement; label: string; icon: string }[] = [
  { id: 'points', label: 'Points', icon: '⠿' },
  { id: 'line', label: 'Line', icon: '⌁' },
  { id: 'bar', label: 'Bars', icon: '▥' },
]

function VariablesDropPanel({ children }: { children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'variables-panel' })
  return <aside ref={setNodeRef} className={`variables-panel panel ${isOver ? 'drop-active' : ''}`}>{children}</aside>
}

function App() {
  const { dataset, spec, past, future, selectedColumn, assign, moveAssignment, setSelectedColumn, setElement, updateSpec, setDataset, updateColumn, undo, redo, reset } = useBuilderStore()
  const [showDataTable, setShowDataTable] = useState(false)
  const [variableSearch, setVariableSearch] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const columnFor = (id?: string) => dataset.columns.find((column) => column.id === id)
  const selected = columnFor(selectedColumn)
  const visibleColumns = dataset.columns.filter((column) => column.name.toLocaleLowerCase().includes(variableSearch.toLocaleLowerCase()))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const columnId = active.data.current?.columnId as string | undefined
    const fromRole = active.data.current?.fromRole as GraphRole | undefined
    if (!columnId) return
    if (over.id === 'variables-panel') {
      if (fromRole) moveAssignment(columnId, undefined, fromRole)
      return
    }
    if (String(over.id).startsWith('role:')) {
      moveAssignment(columnId, String(over.id).replace('role:', '') as GraphRole, fromRole)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">GB</span><span>Graph Builder</span><span className="version">prototype</span></div>
          <div className="document-name"><span className="status-dot" />{dataset.name}</div>
          <div className="toolbar-actions">
            <ImportDataButton onImport={setDataset} />
            <button onClick={undo} disabled={!past.length} title="Undo">↶</button>
            <button onClick={redo} disabled={!future.length} title="Redo">↷</button>
            <button className="secondary" onClick={reset}>Reset example</button>
          </div>
        </header>

        <main className="workspace">
          <VariablesDropPanel>
            <div className="panel-heading">
              <div><span className="eyebrow">DATA</span><h2>Variables</h2></div>
              <span className="count-badge">{dataset.columns.length}</span>
            </div>
            <label className="search"><span>⌕</span><input value={variableSearch} onChange={(event) => setVariableSearch(event.target.value)} placeholder="Search variables" aria-label="Search variables" /></label>
            <div className="variable-list">
              {visibleColumns.map((column) => (
                <VariableCard key={column.id} column={column} selected={selectedColumn === column.id} onSelect={() => setSelectedColumn(column.id)} />
              ))}
              {!visibleColumns.length && <p className="no-variables">No matching variables</p>}
            </div>
            <div className="modeling-key"><span><i className="continuous" /> Continuous</span><span><i className="nominal" /> Nominal</span><span><i className="ordinal" /> Ordinal</span></div>
            <div className="data-summary"><strong>{dataset.rows.length}</strong> rows <span>•</span> <strong>{dataset.columns.length}</strong> columns <button onClick={() => setShowDataTable(true)}>View data table</button></div>
          </VariablesDropPanel>

          <section className="builder-area">
            <div className="element-toolbar">
              <span className="tool-label">ELEMENT</span>
              {graphElements.map((element) => <button key={element.id} className={spec.element === element.id ? 'active' : ''} onClick={() => setElement(element.id)}><span>{element.icon}</span>{element.label}</button>)}
              <div className="toolbar-spacer" />
              <span className="offline-pill">● Offline</span>
            </div>
            <div className="graph-builder-grid">
              <div className="group-x-zone"><DropZone role="groupX" label="Group X" column={columnFor(spec.groupX)} onClear={() => assign('groupX', undefined)} /></div>
              <div className="wrap-zone"><DropZone role="wrap" label="Wrap" column={columnFor(spec.wrap)} onClear={() => assign('wrap', undefined)} /></div>
              <div className="group-y-zone"><DropZone role="groupY" label="Group Y" column={columnFor(spec.groupY)} onClear={() => assign('groupY', undefined)} /></div>
              <div className="y-zone"><DropZone role="y" label="Y" column={columnFor(spec.y)} onClear={() => assign('y', undefined)} /></div>
              <div className="graph-card"><GraphCanvas /></div>
              <div className="x-zone"><DropZone role="x" label="X" column={columnFor(spec.x)} onClear={() => assign('x', undefined)} /></div>
              <div className="encoding-zones">
                <DropZone role="overlay" label="Overlay" column={columnFor(spec.overlay)} onClear={() => assign('overlay', undefined)} />
                <DropZone role="color" label="Color" column={columnFor(spec.color)} onClear={() => assign('color', undefined)} />
                <DropZone role="size" label="Size" column={columnFor(spec.size)} onClear={() => assign('size', undefined)} />
              </div>
            </div>
          </section>

          <aside className="properties-panel panel">
            <div className="panel-heading"><div><span className="eyebrow">FORMAT</span><h2>Properties</h2></div></div>
            {selected && <section className="property-section column-properties">
              <h3>Selected column</h3>
              <label>Name<input value={selected.name} onChange={(event) => updateColumn(selected.id, { name: event.target.value })} /></label>
              <div className="property-grid">
                <label>Data type<select value={selected.dataType} onChange={(event) => updateColumn(selected.id, { dataType: event.target.value as typeof selected.dataType })}><option value="number">Numeric</option><option value="text">Text</option><option value="date">Date/time</option><option value="boolean">Boolean</option></select></label>
                <label>Modeling type<select value={selected.modelingType} onChange={(event) => updateColumn(selected.id, { modelingType: event.target.value as typeof selected.modelingType })}><option value="continuous">Continuous</option><option value="ordinal">Ordinal</option><option value="nominal">Nominal</option></select></label>
              </div>
              <label>Unit<input value={selected.unit ?? ''} placeholder="Optional" onChange={(event) => updateColumn(selected.id, { unit: event.target.value })} /></label>
            </section>}
            <section className="property-section">
              <h3>Graph</h3>
              <label>Title<input value={spec.title} onChange={(event) => updateSpec({ title: event.target.value })} /></label>
              <label>Subtitle<input value={spec.subtitle} onChange={(event) => updateSpec({ subtitle: event.target.value })} /></label>
            </section>
            <section className="property-section">
              <h3>Marks</h3>
              <label className="range-label"><span>Marker size</span><output>{spec.markerSize}px</output><input type="range" min="4" max="18" value={spec.markerSize} onChange={(event) => updateSpec({ markerSize: Number(event.target.value) })} /></label>
            </section>
            <section className="property-section">
              <h3>Axes</h3>
              <label className="toggle-row"><span>Show grid lines</span><input type="checkbox" checked={spec.showGrid} onChange={(event) => updateSpec({ showGrid: event.target.checked })} /></label>
            </section>
            <div className="coming-next"><span>COMING NEXT</span><strong>More graph elements and statistics</strong><p>Summary plots, error bars, regression, and smoothers.</p></div>
          </aside>
        </main>
      </div>
      {showDataTable && <DataTableModal onClose={() => setShowDataTable(false)} />}
    </DndContext>
  )
}

export default App
