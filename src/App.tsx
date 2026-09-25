import { closestCenter, DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { DataTableModal } from './components/DataTableModal'
import { DropZone } from './components/DropZone'
import { GraphCanvas } from './components/GraphCanvas'
import { ActiveFiltersPopup, FilterDropZone, FilterPopup } from './components/FilterDropZone'
import { ImportDataButton } from './components/ImportDataButton'
import { PlotSetupModal } from './components/PlotSetupModal'
import { VariableCard } from './components/VariableCard'
import { elementLabel, suggestElement } from './compatibility'
import { stackCompatibility } from './plotTransforms'
import { rowMatchesFilters, useBuilderStore } from './store'
import type { BarAggregation, BoxPointMode, ErrorBarType, GraphElement, GraphRole, GraphSpec } from './types'
import './App.css'

const graphElements: { id: GraphElement; label: string; icon: string }[] = [
  { id: 'points', label: 'Points', icon: '⠿' },
  { id: 'line', label: 'Line', icon: '⌁' },
  { id: 'bar', label: 'Bars', icon: '▥' },
  { id: 'histogram', label: 'Histogram', icon: '▥' },
  { id: 'box', label: 'Box plot', icon: '⊟' },
  { id: 'area', label: 'Area', icon: '◩' },
  { id: 'summary', label: 'Mean line', icon: 'x̄' },
  { id: 'fit', label: 'Fit', icon: '⌿' },
]

function VariablesDropPanel({ children }: { children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'variables-panel' })
  return <aside ref={setNodeRef} className={`variables-panel panel ${isOver ? 'drop-active' : ''}`}>{children}</aside>
}

function LayerTool({ element, onAdd }: { element: { id: GraphElement; label: string; icon: string }; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `layer-tool:${element.id}`, data: { layerElement: element.id } })
  const help = element.id === 'summary' ? 'Add a mean line with one averaged point per X value' : `Click or drag onto the graph to add a ${element.label.toLocaleLowerCase()} layer`
  return <button ref={setNodeRef} className={isDragging ? 'dragging' : ''} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined} onClick={onAdd} title={help} {...listeners} {...attributes}><span>{element.icon}</span>{element.label}</button>
}

type ResizeDirection = 'horizontal' | 'vertical' | 'both'
type SidePanel = 'variables' | 'properties'

function LayerCanvas({ onResizeStart, onResizeKey }: { onResizeStart: (direction: ResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) => void; onResizeKey: (direction: ResizeDirection, event: ReactKeyboardEvent<HTMLButtonElement>) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'layer-canvas' })
  return <div ref={setNodeRef} className={`graph-card ${isOver ? 'layer-drop-active' : ''}`}>
    <GraphCanvas />
    <button className="canvas-resize-handle horizontal" aria-label="Resize graph width" title="Drag to resize graph width; arrow keys also resize" onPointerDown={(event) => onResizeStart('horizontal', event)} onKeyDown={(event) => onResizeKey('horizontal', event)} />
    <button className="canvas-resize-handle vertical" aria-label="Resize graph height" title="Drag to resize graph height; arrow keys also resize" onPointerDown={(event) => onResizeStart('vertical', event)} onKeyDown={(event) => onResizeKey('vertical', event)} />
    <button className="canvas-resize-handle corner" aria-label="Resize graph width and height" title="Drag to resize graph; arrow keys also resize" onPointerDown={(event) => onResizeStart('both', event)} onKeyDown={(event) => onResizeKey('both', event)} />
  </div>
}

function ReferenceControls({ spec, updateSpec }: { spec: GraphSpec; updateSpec: (patch: Partial<GraphSpec>) => void }) {
  const lines = spec.referenceLines ?? []; const regions = spec.referenceRegions ?? []
  return <div className="reference-controls">
    <div className="reference-heading"><strong>Reference lines</strong><button onClick={() => updateSpec({ referenceLines: [...lines, { id: crypto.randomUUID(), axis: 'y', value: 0, label: '', color: '#c2413b' }] })}>+ Line</button></div>
    {lines.map((line) => <div className="reference-row" key={line.id}><select aria-label="Reference line axis" value={line.axis} onChange={(event) => updateSpec({ referenceLines: lines.map((item) => item.id === line.id ? { ...item, axis: event.target.value as 'x' | 'y' } : item) })}><option value="x">X</option><option value="y">Y</option></select><input aria-label="Reference line value" type="number" value={line.value} onChange={(event) => updateSpec({ referenceLines: lines.map((item) => item.id === line.id ? { ...item, value: Number(event.target.value) } : item) })} /><input aria-label="Reference line label" placeholder="Label" value={line.label ?? ''} onChange={(event) => updateSpec({ referenceLines: lines.map((item) => item.id === line.id ? { ...item, label: event.target.value } : item) })} /><input aria-label="Reference line color" type="color" value={line.color} onChange={(event) => updateSpec({ referenceLines: lines.map((item) => item.id === line.id ? { ...item, color: event.target.value } : item) })} /><button aria-label="Remove reference line" onClick={() => updateSpec({ referenceLines: lines.filter((item) => item.id !== line.id) })}>×</button></div>)}
    <div className="reference-heading"><strong>Acceptance regions</strong><button onClick={() => updateSpec({ referenceRegions: [...regions, { id: crypto.randomUUID(), axis: 'y', min: 0, max: 1, label: '', color: '#d9a441' }] })}>+ Region</button></div>
    {regions.map((region) => <div className="reference-row region" key={region.id}><select aria-label="Reference region axis" value={region.axis} onChange={(event) => updateSpec({ referenceRegions: regions.map((item) => item.id === region.id ? { ...item, axis: event.target.value as 'x' | 'y' } : item) })}><option value="x">X</option><option value="y">Y</option></select><input aria-label="Reference region minimum" type="number" value={region.min} onChange={(event) => updateSpec({ referenceRegions: regions.map((item) => item.id === region.id ? { ...item, min: Number(event.target.value) } : item) })} /><input aria-label="Reference region maximum" type="number" value={region.max} onChange={(event) => updateSpec({ referenceRegions: regions.map((item) => item.id === region.id ? { ...item, max: Number(event.target.value) } : item) })} /><input aria-label="Reference region color" type="color" value={region.color} onChange={(event) => updateSpec({ referenceRegions: regions.map((item) => item.id === region.id ? { ...item, color: event.target.value } : item) })} /><button aria-label="Remove reference region" onClick={() => updateSpec({ referenceRegions: regions.filter((item) => item.id !== region.id) })}>×</button></div>)}
  </div>
}

function App() {
  const { dataset, spec, filters, past, future, selectedColumn, compatibilityMessage, moveAssignment, setSelectedColumn, addLayer, removeLayer, updateLayer, setActiveLayer, swapAxes, applySuggestion, setPageValue, clearCompatibilityMessage, updateSpec, setDataset, updateColumn, setValueLabels, undo, redo, reset } = useBuilderStore()
  const [showDataTable, setShowDataTable] = useState(false)
  const [showPlotSetups, setShowPlotSetups] = useState(false)
  const [variableSearch, setVariableSearch] = useState('')
  const [filterColumnId, setFilterColumnId] = useState<string>()
  const [showActiveFilters, setShowActiveFilters] = useState(false)
  const [dragColumnId, setDragColumnId] = useState<string>()
  const [dragElement, setDragElement] = useState<GraphElement>()
  const [canvasSize, setCanvasSize] = useState<{ width?: number; height?: number }>({})
  const [panelWidths, setPanelWidths] = useState({ variables: 250, properties: 280 })
  const [panelVisibility, setPanelVisibility] = useState({ variables: true, properties: true })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const columnFor = (id?: string) => dataset.columns.find((column) => column.id === id)
  const selected = columnFor(selectedColumn)
  const columnsFor = (ids: string[] = []) => ids.map((id) => columnFor(id)).filter((column): column is NonNullable<typeof column> => Boolean(column))
  const singleton = (id?: string) => columnsFor(id ? [id] : [])
  const activeLayer = spec.layers.find((layer) => layer.id === spec.activeLayerId) ?? spec.layers[0]
  const pageColumn = columnFor(spec.page)
  const pageValues = pageColumn ? [...new Map(dataset.rows.map((row) => [String(row.values[pageColumn.id]), row.values[pageColumn.id]])).values()] : []
  const pageIndex = pageValues.findIndex((value) => value === spec.pageValue)
  const visibleColumns = dataset.columns.filter((column) => column.name.toLocaleLowerCase().includes(variableSearch.toLocaleLowerCase()))
  const suggestionX = columnsFor(activeLayer?.x ? [activeLayer.x] : spec.x); const suggestionY = columnsFor(activeLayer?.y ? [activeLayer.y] : spec.y)
  const suggestionRows = dataset.rows.filter((row) => !row.excluded && rowMatchesFilters(row, filters) && (!spec.page || spec.pageValue === undefined || row.values[spec.page] === spec.pageValue))
  const suggestion = suggestElement(suggestionX, suggestionY, suggestionRows); const suggestionMatches = activeLayer?.element === suggestion.element
  const suggestionHelp = `${suggestionMatches ? 'Already using' : `Use ${elementLabel(suggestion.element)}`}: ${suggestion.reason}`
  const stackCheck = stackCompatibility(suggestionRows, activeLayer?.x ?? spec.x[0], activeLayer?.color ?? spec.color ?? spec.overlay)

  const startCanvasResize = (direction: ResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation()
    const card = event.currentTarget.closest('.graph-card'); if (!card) return
    const bounds = card.getBoundingClientRect(); const startX = event.clientX; const startY = event.clientY
    const move = (pointer: PointerEvent) => setCanvasSize((current) => ({
      width: direction === 'vertical' ? current.width : Math.max(280, Math.min(1400, bounds.width + pointer.clientX - startX)),
      height: direction === 'horizontal' ? current.height : Math.max(260, Math.min(1100, bounds.height + pointer.clientY - startY)),
    }))
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true })
  }
  const resizeCanvasByKey = (direction: ResizeDirection, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const horizontal = event.key === 'ArrowLeft' ? -24 : event.key === 'ArrowRight' ? 24 : 0; const vertical = event.key === 'ArrowUp' ? -24 : event.key === 'ArrowDown' ? 24 : 0
    if ((!horizontal && !vertical) || (direction === 'horizontal' && !horizontal) || (direction === 'vertical' && !vertical)) return
    event.preventDefault(); const bounds = event.currentTarget.closest('.graph-card')?.getBoundingClientRect(); if (!bounds) return
    setCanvasSize((current) => ({ width: direction === 'vertical' ? current.width : Math.max(280, Math.min(1400, (current.width ?? bounds.width) + horizontal)), height: direction === 'horizontal' ? current.height : Math.max(260, Math.min(1100, (current.height ?? bounds.height) + vertical)) }))
  }
  const startPanelResize = (panel: SidePanel, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); const startX = event.clientX; const startWidth = panelWidths[panel]
    const move = (pointer: PointerEvent) => { const delta = pointer.clientX - startX; setPanelWidths((current) => ({ ...current, [panel]: Math.max(panel === 'variables' ? 170 : 220, Math.min(panel === 'variables' ? 420 : 480, startWidth + (panel === 'variables' ? delta : -delta))) })) }
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true })
  }
  const resizePanelByKey = (panel: SidePanel, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0; if (!delta) return
    event.preventDefault(); setPanelWidths((current) => ({ ...current, [panel]: Math.max(panel === 'variables' ? 170 : 220, Math.min(panel === 'variables' ? 420 : 480, current[panel] + (panel === 'variables' ? delta : -delta))) }))
  }

  const handleDragEnd = ({ active, over, delta }: DragEndEvent) => {
    setDragColumnId(undefined)
    setDragElement(undefined)
    if (!over) return
    const layerElement = active.data.current?.layerElement as GraphElement | undefined
    if (layerElement) { if (over.id === 'layer-canvas') addLayer(layerElement); return }
    const columnId = active.data.current?.columnId as string | undefined
    const fromRole = active.data.current?.fromRole as GraphRole | undefined
    const fromIndex = active.data.current?.fromIndex as number | undefined
    if (!columnId) return
    if (over.id === 'filter-zone') {
      setFilterColumnId(columnId)
      return
    }
    if (over.id === 'variables-panel') {
      if (fromRole) moveAssignment(columnId, undefined, fromRole)
      return
    }
    const targetRole = over.data.current?.role as GraphRole | undefined
    let targetIndex = over.data.current?.index as number | undefined
    if (targetRole === fromRole && targetIndex === undefined && fromIndex !== undefined) {
      const movement = targetRole === 'y' ? delta.y : delta.x
      if (Math.abs(movement) > 10) targetIndex = Math.max(0, fromIndex + (movement < 0 ? -1 : 1))
    }
    if (targetRole) moveAssignment(columnId, targetRole, fromRole, targetIndex)
  }
  const handleDragStart = ({ active }: DragStartEvent) => { setDragColumnId(active.data.current?.columnId as string | undefined); setDragElement(active.data.current?.layerElement as GraphElement | undefined) }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={() => { setDragColumnId(undefined); setDragElement(undefined) }} onDragEnd={handleDragEnd}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">GB</span><span>Graph Builder</span><span className="version">prototype</span><button className="brand-setup" onClick={() => setShowPlotSetups(true)}>Plot setups</button></div>
          <div className="document-name"><span className="status-dot" />{dataset.name}</div>
          <div className="toolbar-actions">
            <button className="panel-toggle" aria-pressed={panelVisibility.variables} onClick={() => setPanelVisibility((current) => ({ ...current, variables: !current.variables }))} title={`${panelVisibility.variables ? 'Hide' : 'Show'} Variables panel`}>☰ <span>Variables</span></button>
            <button className="panel-toggle" aria-pressed={panelVisibility.properties} onClick={() => setPanelVisibility((current) => ({ ...current, properties: !current.properties }))} title={`${panelVisibility.properties ? 'Hide' : 'Show'} Properties panel`}><span>Properties</span> ◫</button>
            <ImportDataButton onImport={setDataset} />
            <button onClick={undo} disabled={!past.length} title="Undo">↶</button>
            <button onClick={redo} disabled={!future.length} title="Redo">↷</button>
            <button className="secondary" onClick={reset}>Reset example</button>
          </div>
        </header>

        <main className="workspace" style={{ gridTemplateColumns: `${panelVisibility.variables ? panelWidths.variables : 0}px minmax(0, 1fr) ${panelVisibility.properties ? panelWidths.properties : 0}px` }}>
          {panelVisibility.variables && <VariablesDropPanel>
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
            <div className="data-summary"><strong>{dataset.rows.length}</strong> rows <span>•</span> <strong>{dataset.columns.length}</strong> columns {dataset.warnings.length > 0 && <span className="warning-count">⚠ {dataset.warnings.length}</span>} <button onClick={() => setShowDataTable(true)}>View data table</button></div>
          </VariablesDropPanel>}
          {panelVisibility.variables && <button className="panel-resize-divider variables-divider" aria-label="Resize Variables panel" title="Drag to resize Variables; use arrow keys for fine adjustment" style={{ left: panelWidths.variables - 4 }} onPointerDown={(event) => startPanelResize('variables', event)} onKeyDown={(event) => resizePanelByKey('variables', event)} />}

          <section className="builder-area">
            <div className="element-toolbar">
              <span className="tool-label">ADD LAYER</span>
              {graphElements.map((element) => <LayerTool key={element.id} element={element} onAdd={() => addLayer(element.id)} />)}
              <button onClick={swapAxes} title="Swap X and Y assignments"><span>⇄</span>Swap X/Y</button>
              {(canvasSize.width || canvasSize.height) && <button onClick={() => setCanvasSize({})} title="Return the graph canvas to the available workspace size"><span>⊞</span>Fit canvas</button>}
              <button className="suggest-button" onClick={applySuggestion} disabled={suggestionMatches} title={suggestionHelp} aria-label={suggestionHelp}><span>✦</span>{suggestionMatches ? `${elementLabel(suggestion.element)} suggested` : `Suggest ${elementLabel(suggestion.element)}`}</button>
              <div className="toolbar-spacer" />
              {pageColumn && <div className="page-stepper"><button disabled={pageIndex <= 0} onClick={() => setPageValue(pageValues[pageIndex - 1])}>‹</button><label>{pageColumn.name}<select value={String(spec.pageValue ?? pageValues[0] ?? '')} onChange={(event) => setPageValue(pageValues.find((value) => String(value) === event.target.value))}>{pageValues.map((value) => <option key={String(value)} value={String(value)}>{String(value)}</option>)}</select></label><button disabled={pageIndex >= pageValues.length - 1} onClick={() => setPageValue(pageValues[pageIndex + 1])}>›</button></div>}
              <span className="offline-pill">● Offline</span>
            </div>
            <div className="graph-builder-grid" style={{ overflowX: canvasSize.width ? 'auto' : 'hidden', overflowY: canvasSize.height ? 'auto' : 'hidden', gridTemplateColumns: `clamp(104px, 11vw, 132px) ${canvasSize.width ? `${canvasSize.width}px` : 'minmax(280px, 1fr)'} clamp(116px, 10vw, 140px)`, gridTemplateRows: `58px ${canvasSize.height ? `${canvasSize.height}px` : 'clamp(300px, calc(100vh - 267px), 620px)'} 64px` }}>
              <div className="filter-zone"><FilterDropZone activeCount={filters.length} onEdit={() => setShowActiveFilters(true)} /></div>
              <div className="group-x-zone"><DropZone role="groupX" label="Group X" columns={singleton(spec.groupX)} onClear={(id) => moveAssignment(id, undefined, 'groupX')} /></div>
              <div className="wrap-zone"><DropZone role="wrap" label="Wrap" columns={singleton(spec.wrap)} onClear={(id) => moveAssignment(id, undefined, 'wrap')} /></div>
              <div className="group-y-zone"><DropZone role="groupY" label="Group Y" columns={singleton(spec.groupY)} onClear={(id) => moveAssignment(id, undefined, 'groupY')} /></div>
              <div className="y-zone"><DropZone role="y" label="Y" columns={columnsFor(spec.y)} onClear={(id) => moveAssignment(id, undefined, 'y')} /></div>
              <LayerCanvas onResizeStart={startCanvasResize} onResizeKey={resizeCanvasByKey} />
              <div className="x-zone"><DropZone role="x" label="X" columns={columnsFor(spec.x)} onClear={(id) => moveAssignment(id, undefined, 'x')} /></div>
              <div className="encoding-zones">
                <DropZone role="overlay" label="Overlay" columns={singleton(spec.overlay)} onClear={(id) => moveAssignment(id, undefined, 'overlay')} />
                <DropZone role="color" label="Color" columns={singleton(spec.color)} onClear={(id) => moveAssignment(id, undefined, 'color')} />
                <DropZone role="shape" label="Shape" columns={singleton(spec.shape)} onClear={(id) => moveAssignment(id, undefined, 'shape')} />
                <DropZone role="size" label="Size" columns={singleton(spec.size)} onClear={(id) => moveAssignment(id, undefined, 'size')} />
                <DropZone role="weight" label="Frequency" columns={singleton(spec.weight)} onClear={(id) => moveAssignment(id, undefined, 'weight')} />
                <DropZone role="page" label="Page" columns={singleton(spec.page)} onClear={(id) => moveAssignment(id, undefined, 'page')} />
              </div>
            </div>
          </section>

          {panelVisibility.properties && <button className="panel-resize-divider properties-divider" aria-label="Resize Properties panel" title="Drag to resize Properties; use arrow keys for fine adjustment" style={{ right: panelWidths.properties - 4 }} onPointerDown={(event) => startPanelResize('properties', event)} onKeyDown={(event) => resizePanelByKey('properties', event)} />}
          {panelVisibility.properties && <aside className="properties-panel panel" tabIndex={0} aria-label="Properties panel">
            <div className="panel-heading"><div><span className="eyebrow">FORMAT</span><h2>Properties</h2></div></div>
            {selected && <section className="property-section column-properties">
              <h3>Selected column</h3>
              <label>Name<input value={selected.name} onChange={(event) => updateColumn(selected.id, { name: event.target.value })} /></label>
              <div className="property-grid">
                <label>Data type<select value={selected.dataType} onChange={(event) => updateColumn(selected.id, { dataType: event.target.value as typeof selected.dataType })}><option value="number">Numeric</option><option value="text">Text</option><option value="date">Date/time</option><option value="boolean">Boolean</option></select></label>
                <label>Modeling type<select value={selected.modelingType} onChange={(event) => updateColumn(selected.id, { modelingType: event.target.value as typeof selected.modelingType })}><option value="continuous">Continuous</option><option value="ordinal">Ordinal</option><option value="nominal">Nominal</option></select></label>
              </div>
              <label>Unit<input value={selected.unit ?? ''} placeholder="Optional" onChange={(event) => updateColumn(selected.id, { unit: event.target.value })} /></label>
              <label>Value labels<textarea rows={3} value={Object.entries(selected.valueLabels ?? {}).map(([value, label]) => `${value} = ${label}`).join('\n')} placeholder={'1 = Prototype A\n2 = Prototype B'} onChange={(event) => setValueLabels(selected.id, Object.fromEntries(event.target.value.split(/\r?\n/).map((line) => line.split('=').map((part) => part.trim())).filter((parts) => parts.length >= 2 && parts[0]).map(([value, ...label]) => [value, label.join('=')])))} /></label>
            </section>}
            <section className="property-section">
              <h3>Layers</h3>
              <div className="layer-list">{spec.layers.map((layer, index) => <div key={layer.id} className={layer.id === activeLayer?.id ? 'active' : ''}><button className="layer-select" onClick={() => setActiveLayer(layer.id)}><span>{index + 1}</span>{layer.name}</button><button className="layer-remove" onClick={() => removeLayer(layer.id)} aria-label={`Remove ${layer.name} layer`}>×</button></div>)}</div>
              {activeLayer && <div className="layer-settings">
                <label>Element<select value={activeLayer.element} onChange={(event) => updateLayer(activeLayer.id, { element: event.target.value as GraphElement, name: event.target.selectedOptions[0].text })}>{graphElements.map((element) => <option value={element.id} key={element.id}>{element.label}</option>)}</select></label>
                {activeLayer.element === 'summary' && <><label>Error bars<select value={activeLayer.errorBar ?? 'sd'} onChange={(event) => updateLayer(activeLayer.id, { errorBar: event.target.value as ErrorBarType })}><option value="sd">Sample SD</option><option value="se">Standard error</option><option value="ci">Confidence interval</option><option value="range">Range</option><option value="none">None</option></select></label>{activeLayer.errorBar === 'ci' && <label>Confidence level<select value={activeLayer.confidenceLevel ?? 0.95} onChange={(event) => updateLayer(activeLayer.id, { confidenceLevel: Number(event.target.value) })}><option value="0.8">80%</option><option value="0.9">90%</option><option value="0.95">95%</option><option value="0.99">99%</option></select></label>}<label className="toggle-row"><span>Show individual observations</span><input type="checkbox" checked={activeLayer.showObservations ?? false} onChange={(event) => updateLayer(activeLayer.id, { showObservations: event.target.checked })} /></label><small>SD uses n − 1. Confidence intervals are two-sided Student's t intervals. Groups with n = 1 show no uncertainty.</small></>}
                {activeLayer.element === 'histogram' && <label>Number of bins<input type="number" min="1" max="100" value={activeLayer.binCount ?? 10} onChange={(event) => updateLayer(activeLayer.id, { binCount: Math.max(1, Number(event.target.value)) })} /></label>}
                {activeLayer.element === 'box' && <label>Show points<select value={activeLayer.boxPoints ?? 'outliers'} onChange={(event) => updateLayer(activeLayer.id, { boxPoints: event.target.value as BoxPointMode })}><option value="outliers">Outliers only</option><option value="all">All observations</option><option value="none">None</option></select><small>Outliers use Tukey's 1.5 × IQR rule.</small></label>}
                {activeLayer.element === 'bar' && <><label>Bar summary<select value={activeLayer.barAggregation ?? 'mean'} onChange={(event) => updateLayer(activeLayer.id, { barAggregation: event.target.value as BarAggregation })}><option value="mean">Mean</option><option value="sum">Sum</option><option value="count">Count</option></select></label><label className="toggle-row"><span>Stack compatible series</span><input type="checkbox" disabled={!stackCheck.compatible} checked={activeLayer.stack ?? false} onChange={(event) => updateLayer(activeLayer.id, { stack: event.target.checked })} /></label>{!stackCheck.compatible && <small className="setting-warning">{stackCheck.reason}</small>}</>}
                {activeLayer.element === 'area' && <><label className="toggle-row"><span>Stack compatible series</span><input type="checkbox" disabled={!stackCheck.compatible} checked={activeLayer.stack ?? false} onChange={(event) => updateLayer(activeLayer.id, { stack: event.target.checked })} /></label>{!stackCheck.compatible && <small className="setting-warning">{stackCheck.reason}</small>}</>}
                <div className="property-grid"><label>X override<select value={activeLayer.x ?? ''} onChange={(event) => updateLayer(activeLayer.id, { x: event.target.value || undefined })}><option value="">Shared</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label><label>Y override<select value={activeLayer.y ?? ''} onChange={(event) => updateLayer(activeLayer.id, { y: event.target.value || undefined })}><option value="">Shared</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label></div>
                <label>Color override<select value={activeLayer.color ?? ''} onChange={(event) => updateLayer(activeLayer.id, { color: event.target.value || undefined })}><option value="">Shared</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label>
                <div className="property-grid"><label>Mark color<input type="color" value={activeLayer.colorHex ?? '#0f6c75'} onChange={(event) => updateLayer(activeLayer.id, { colorHex: event.target.value })} /></label><label>Marker size<input type="number" min="2" max="30" value={activeLayer.markerSize ?? spec.markerSize} onChange={(event) => updateLayer(activeLayer.id, { markerSize: Number(event.target.value) })} /></label><label>Line width<input type="number" min="1" max="8" value={activeLayer.lineWidth ?? 2.5} onChange={(event) => updateLayer(activeLayer.id, { lineWidth: Number(event.target.value) })} /></label></div>
              </div>}
            </section>
            <section className="property-section">
              <h3>Graph</h3>
              <label>Title<input value={spec.title} onChange={(event) => updateSpec({ title: event.target.value })} /></label>
              <label>Subtitle<input value={spec.subtitle} onChange={(event) => updateSpec({ subtitle: event.target.value })} /></label>
              <ReferenceControls spec={spec} updateSpec={updateSpec} />
            </section>
            <section className="property-section">
              <h3>Marks</h3>
              <label className="range-label"><span>Marker size</span><output>{spec.markerSize}px</output><input type="range" min="4" max="18" value={spec.markerSize} onChange={(event) => updateSpec({ markerSize: Number(event.target.value) })} /></label>
            </section>
            <section className="property-section">
              <h3>Axes</h3>
              <label className="toggle-row"><span>Show grid lines</span><input type="checkbox" checked={spec.showGrid} onChange={(event) => updateSpec({ showGrid: event.target.checked })} /></label>
            </section>
            <div className="coming-next"><span>PHASE 5</span><strong>Statistical transformations</strong><p>Next: precomputed errors, descriptive summaries, regression diagnostics, and normalization.</p></div>
          </aside>}
        </main>
      </div>
      {showDataTable && <DataTableModal onClose={() => setShowDataTable(false)} />}
      {showPlotSetups && <PlotSetupModal onClose={() => setShowPlotSetups(false)} />}
      {filterColumnId && columnFor(filterColumnId) && <FilterPopup column={columnFor(filterColumnId)!} onClose={() => setFilterColumnId(undefined)} />}
      {showActiveFilters && <ActiveFiltersPopup onClose={() => setShowActiveFilters(false)} onEdit={(columnId) => { setShowActiveFilters(false); setFilterColumnId(columnId) }} />}
      {compatibilityMessage && <div className="compatibility-message" role="alert"><span>{compatibilityMessage}</span><button onClick={clearCompatibilityMessage}>×</button></div>}
      {dragColumnId && <div className="drag-preview" role="status"><strong>{columnFor(dragColumnId)?.name}</strong><span>Drop on a role to assign · X and Y accept multiple variables · Size requires numeric data · Frequency requires whole-number counts</span></div>}
      {dragElement && <div className="drag-preview" role="status"><strong>{dragElement}</strong><span>Drop onto the graph to add this layer without changing role assignments</span></div>}
    </DndContext>
  )
}

export default App
