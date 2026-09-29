import { closestCenter, DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { DataTableModal } from './components/DataTableModal'
import { DropZone } from './components/DropZone'
import { GraphCanvas } from './components/GraphCanvas'
import { AppearanceControls } from './components/AppearanceControls'
import { CollapsibleSection } from './components/CollapsibleSection'
import { ActiveFiltersPopup, FilterDropZone, FilterPopup } from './components/FilterDropZone'
import { ImportDataButton } from './components/ImportDataButton'
import { PlotSetupModal } from './components/PlotSetupModal'
import { ProjectModal } from './components/ProjectModal'
import { VariableCard } from './components/VariableCard'
import { elementLabel, suggestElement } from './compatibility'
import { downloadImage, renderGraphImage, safeFileName } from './graphExport'
import { stackCompatibility } from './plotTransforms'
import { rowMatchesFilters, useBuilderStore } from './store'
import { useProjectRecovery } from './useProjectRecovery'
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
  const { dataset, spec } = useBuilderStore()
  return <div ref={setNodeRef} className={`graph-card ${isOver ? 'layer-drop-active' : ''}`} role="region" aria-label="Graph preview" aria-describedby="graph-a11y-summary">
    <p id="graph-a11y-summary" className="visually-hidden">{spec.title || 'Untitled graph'}. {dataset.rows.length} source rows. X: {spec.x.map((id) => dataset.columns.find((column) => column.id === id)?.name ?? id).join(', ') || 'none'}. Y: {spec.y.map((id) => dataset.columns.find((column) => column.id === id)?.name ?? id).join(', ') || 'none'}. Use Properties to change the chart and Projects and export to download plotted data.</p>
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
    {regions.map((region) => <label key={`${region.id}-label`}>Region label<input value={region.label ?? ''} placeholder="Optional benchmark label" onChange={(event) => updateSpec({ referenceRegions: regions.map((item) => item.id === region.id ? { ...item, label: event.target.value } : item) })} /></label>)}
  </div>
}

function App() {
  const { dataset, spec, filters, projectName, activeGraphName, past, future, selectedColumn, compatibilityMessage, moveAssignment, setSelectedColumn, addLayer, removeLayer, updateLayer, setActiveLayer, swapAxes, applySuggestion, setPageValue, clearCompatibilityMessage, updateSpec, setDataset, updateColumn, setValueLabels, undo, redo, reset } = useBuilderStore()
  const [showDataTable, setShowDataTable] = useState(false)
  const [showPlotSetups, setShowPlotSetups] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [savingPng, setSavingPng] = useState(false)
  const [pngError, setPngError] = useState<string>()
  const recovery = useProjectRecovery()
  const [variableSearch, setVariableSearch] = useState('')
  const [keyboardRole, setKeyboardRole] = useState<GraphRole>('x')
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
  const splitX = spec.x.length > 1 && spec.xDisplay === 'subplots'
  const splitY = spec.y.length > 1 && spec.yDisplay === 'subplots'
  const axisPanelCount = (splitX ? spec.x.length : 1) * (splitY ? spec.y.length : 1)
  const subplotCount = spec.panels?.length || (splitX || splitY ? axisPanelCount : 0)
  const subplotColumns = Math.min(subplotCount, Math.max(1, Math.round(spec.subplotColumns ?? Math.ceil(Math.sqrt(subplotCount)))))
  const customPanelHeight = subplotCount ? Math.ceil(subplotCount / (spec.panels?.length ? Math.ceil(Math.sqrt(subplotCount)) : subplotColumns)) * 320 + 80 : undefined
  const canCollate = spec.x.length === 1 && columnFor(spec.x[0])?.modelingType !== 'continuous' && spec.layers.every((layer) => ['bar', 'points', 'box'].includes(layer.element))

  const savePng = async () => {
    setSavingPng(true); setPngError(undefined)
    try {
      const image = await renderGraphImage('png', spec.graphWidth ?? 1200, spec.graphHeight ?? 800, 2)
      downloadImage(`${safeFileName(activeGraphName)}.png`, image)
    } catch (error) { setPngError(error instanceof Error ? error.message : 'The PNG could not be saved.') }
    finally { setSavingPng(false) }
  }

  const startCanvasResize = (direction: ResizeDirection, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation()
    const card = event.currentTarget.closest('.graph-card'); if (!card) return
    const bounds = card.getBoundingClientRect(); const startX = event.clientX; const startY = event.clientY
    let finalSize: { width?: number; height?: number } = {}
    const move = (pointer: PointerEvent) => setCanvasSize((current) => { finalSize = {
      width: direction === 'vertical' ? current.width : Math.max(280, Math.min(1400, bounds.width + pointer.clientX - startX)),
      height: direction === 'horizontal' ? current.height : Math.max(260, Math.min(1100, bounds.height + pointer.clientY - startY)),
    }; return finalSize })
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); if (finalSize.width || finalSize.height) { updateSpec({ graphWidth: finalSize.width ?? spec.graphWidth, graphHeight: finalSize.height ?? spec.graphHeight, aspectRatio: undefined }); setCanvasSize({}) } }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true })
  }
  const resizeCanvasByKey = (direction: ResizeDirection, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const horizontal = event.key === 'ArrowLeft' ? -24 : event.key === 'ArrowRight' ? 24 : 0; const vertical = event.key === 'ArrowUp' ? -24 : event.key === 'ArrowDown' ? 24 : 0
    if ((!horizontal && !vertical) || (direction === 'horizontal' && !horizontal) || (direction === 'vertical' && !vertical)) return
    event.preventDefault(); const bounds = event.currentTarget.closest('.graph-card')?.getBoundingClientRect(); if (!bounds) return
    updateSpec({ graphWidth: direction === 'vertical' ? spec.graphWidth : Math.max(280, Math.min(1400, (spec.graphWidth ?? bounds.width) + horizontal)), graphHeight: direction === 'horizontal' ? spec.graphHeight : Math.max(260, Math.min(1100, (spec.graphHeight ?? bounds.height) + vertical)), aspectRatio: undefined })
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
          <div className="brand"><span className="brand-mark">GB</span><span>Graph Builder</span><span className="version">prototype</span><button className="brand-setup" onClick={() => setShowPlotSetups(true)}>Plot setups</button><button className="brand-setup" onClick={() => setShowProjects(true)}>Projects & export</button><button className="brand-setup" disabled={savingPng} onClick={() => void savePng()} title="Download the open graph as a 2× PNG">{savingPng ? 'Saving…' : 'Save PNG'}</button></div>
          <div className="document-name"><span className="status-dot" />{projectName} · {activeGraphName}</div>
          <div className="toolbar-actions">
            <button className="panel-toggle" aria-pressed={panelVisibility.variables} onClick={() => setPanelVisibility((current) => ({ ...current, variables: !current.variables }))} title={`${panelVisibility.variables ? 'Hide' : 'Show'} Variables panel`}>☰ <span>Variables</span></button>
            <button className="panel-toggle" aria-pressed={panelVisibility.properties} onClick={() => setPanelVisibility((current) => ({ ...current, properties: !current.properties }))} title={`${panelVisibility.properties ? 'Hide' : 'Show'} Properties panel`}><span>Properties</span> ◫</button>
            <ImportDataButton onImport={(incoming) => { if (window.confirm('Import this data and replace the current project? Download an embedded project first if you need to keep your work. You can also use Undo immediately after importing.')) setDataset(incoming) }} />
            <button onClick={undo} disabled={!past.length} title="Undo">↶</button>
            <button onClick={redo} disabled={!future.length} title="Redo">↷</button>
            <button className="secondary" onClick={() => { if (window.confirm('Reset to the example data? This closes the current project and clears Undo. Download an embedded project first if you need to keep your work.')) reset() }}>Reset example</button>
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
              {(canvasSize.width || canvasSize.height || spec.graphWidth || spec.graphHeight || spec.aspectRatio) && <button onClick={() => { setCanvasSize({}); updateSpec({ graphWidth: undefined, graphHeight: undefined, aspectRatio: undefined }) }} title="Return the graph canvas to the available workspace size"><span>⊞</span>Fit canvas</button>}
              <button className="suggest-button" onClick={applySuggestion} disabled={suggestionMatches} title={suggestionHelp} aria-label={suggestionHelp}><span>✦</span>{suggestionMatches ? `${elementLabel(suggestion.element)} suggested` : `Suggest ${elementLabel(suggestion.element)}`}</button>
              <div className="toolbar-spacer" />
              {pageColumn && <div className="page-stepper"><button disabled={pageIndex <= 0} onClick={() => setPageValue(pageValues[pageIndex - 1])}>‹</button><label>{pageColumn.name}<select value={String(spec.pageValue ?? pageValues[0] ?? '')} onChange={(event) => setPageValue(pageValues.find((value) => String(value) === event.target.value))}>{pageValues.map((value) => <option key={String(value)} value={String(value)}>{String(value)}</option>)}</select></label><button disabled={pageIndex >= pageValues.length - 1} onClick={() => setPageValue(pageValues[pageIndex + 1])}>›</button></div>}
              <span className="offline-pill">● Offline</span>
            </div>
            <div className="graph-builder-grid" style={{ overflowX: canvasSize.width || spec.graphWidth ? 'auto' : 'hidden', overflowY: canvasSize.height || spec.graphHeight || spec.aspectRatio || (customPanelHeight && customPanelHeight > 620) ? 'auto' : 'hidden', gridTemplateColumns: `clamp(104px, 11vw, 132px) ${canvasSize.width || spec.graphWidth ? `${canvasSize.width ?? spec.graphWidth}px` : 'minmax(280px, 1fr)'} clamp(116px, 10vw, 140px)`, gridTemplateRows: `58px ${canvasSize.height || spec.graphHeight || spec.aspectRatio ? `${canvasSize.height ?? spec.graphHeight ?? Math.round((canvasSize.width ?? spec.graphWidth ?? 700) / (spec.aspectRatio ?? 1.5))}px` : customPanelHeight ? `${Math.max(620, customPanelHeight)}px` : 'clamp(300px, calc(100vh - 267px), 620px)'} 64px` }}>
              <div className="filter-zone"><FilterDropZone activeCount={filters.length} onEdit={() => setShowActiveFilters(true)} /></div>
              <div className="group-x-zone"><DropZone role="groupX" label="Group X" columns={singleton(spec.groupX)} onClear={(id) => moveAssignment(id, undefined, 'groupX')} /></div>
              <div className="wrap-zone"><DropZone role="wrap" label="Wrap" columns={singleton(spec.wrap)} onClear={(id) => moveAssignment(id, undefined, 'wrap')} /></div>
              <div className="group-y-zone"><DropZone role="groupY" label="Group Y" columns={singleton(spec.groupY)} onClear={(id) => moveAssignment(id, undefined, 'groupY')} /></div>
              <div className="y-zone"><DropZone role="y" label="Y" columns={columnsFor(spec.y)} onClear={(id) => moveAssignment(id, undefined, 'y')} /></div>
              <LayerCanvas onResizeStart={startCanvasResize} onResizeKey={resizeCanvasByKey} />
              <div className="x-zone"><DropZone role="x" label="X" columns={columnsFor(spec.x)} onClear={(id) => moveAssignment(id, undefined, 'x')} /></div>
              <div className="encoding-zones">
                <DropZone role="page" label="Page" columns={singleton(spec.page)} onClear={(id) => moveAssignment(id, undefined, 'page')} />
                <DropZone role="overlay" label="Overlay" columns={singleton(spec.overlay)} onClear={(id) => moveAssignment(id, undefined, 'overlay')} />
                <DropZone role="color" label="Color" columns={singleton(spec.color)} onClear={(id) => moveAssignment(id, undefined, 'color')} />
                <DropZone role="shape" label="Shape" columns={singleton(spec.shape)} onClear={(id) => moveAssignment(id, undefined, 'shape')} />
                <DropZone role="size" label="Size" columns={singleton(spec.size)} onClear={(id) => moveAssignment(id, undefined, 'size')} />
                <DropZone role="weight" label="Frequency" columns={singleton(spec.weight)} onClear={(id) => moveAssignment(id, undefined, 'weight')} />
              </div>
            </div>
          </section>

          {panelVisibility.properties && <button className="panel-resize-divider properties-divider" aria-label="Resize Properties panel" title="Drag to resize Properties; use arrow keys for fine adjustment" style={{ right: panelWidths.properties - 4 }} onPointerDown={(event) => startPanelResize('properties', event)} onKeyDown={(event) => resizePanelByKey('properties', event)} />}
          {panelVisibility.properties && <aside className="properties-panel panel" tabIndex={0} aria-label="Properties panel">
            <div className="panel-heading"><div><span className="eyebrow">FORMAT</span><h2>Properties</h2></div></div>
            {selected && <CollapsibleSection title="Selected column" className="column-properties">
              <label>Name<input value={selected.name} onChange={(event) => updateColumn(selected.id, { name: event.target.value })} /></label>
              <div className="keyboard-assignment"><label>Assign selected column to<select value={keyboardRole} onChange={(event) => setKeyboardRole(event.target.value as GraphRole)}><option value="x">X axis</option><option value="y">Y axis</option><option value="color">Color</option><option value="groupX">Group X</option><option value="groupY">Group Y</option><option value="wrap">Wrap</option><option value="overlay">Overlay</option><option value="size">Size</option><option value="shape">Shape</option><option value="weight">Frequency</option><option value="page">Page</option></select></label><button onClick={() => moveAssignment(selected.id, keyboardRole)}>Assign</button></div>
              <button className="filter-selected-button" onClick={() => setFilterColumnId(selected.id)}>Filter selected column</button>
              <div className="property-grid">
                <label>Data type<select value={selected.dataType} onChange={(event) => updateColumn(selected.id, { dataType: event.target.value as typeof selected.dataType })}><option value="number">Numeric</option><option value="text">Text</option><option value="date">Date/time</option><option value="boolean">Boolean</option></select></label>
                <label>Modeling type<select value={selected.modelingType} onChange={(event) => updateColumn(selected.id, { modelingType: event.target.value as typeof selected.modelingType })}><option value="continuous">Continuous</option><option value="ordinal">Ordinal</option><option value="nominal">Nominal</option></select></label>
              </div>
              <label>Unit<input value={selected.unit ?? ''} placeholder="Optional" onChange={(event) => updateColumn(selected.id, { unit: event.target.value })} /></label>
              <label>Value labels<textarea rows={3} value={Object.entries(selected.valueLabels ?? {}).map(([value, label]) => `${value} = ${label}`).join('\n')} placeholder={'1 = Prototype A\n2 = Prototype B'} onChange={(event) => setValueLabels(selected.id, Object.fromEntries(event.target.value.split(/\r?\n/).map((line) => line.split('=').map((part) => part.trim())).filter((parts) => parts.length >= 2 && parts[0]).map(([value, ...label]) => [value, label.join('=')])))} /></label>
            </CollapsibleSection>}
            <CollapsibleSection title="Layers">
              <div className="layer-list">{spec.layers.map((layer, index) => <div key={layer.id} className={layer.id === activeLayer?.id ? 'active' : ''}><button className="layer-select" onClick={() => setActiveLayer(layer.id)}><span>{index + 1}</span>{layer.name}</button><button className="layer-remove" onClick={() => removeLayer(layer.id)} aria-label={`Remove ${layer.name} layer`}>×</button></div>)}</div>
              {activeLayer && <div className="layer-settings">
                <label>Element<select value={activeLayer.element} onChange={(event) => updateLayer(activeLayer.id, { element: event.target.value as GraphElement, name: event.target.selectedOptions[0].text })}>{graphElements.map((element) => <option value={element.id} key={element.id}>{element.label}</option>)}</select></label>
                {activeLayer.element === 'summary' && <><label>Error bars<select value={activeLayer.errorBar ?? 'sd'} onChange={(event) => updateLayer(activeLayer.id, { errorBar: event.target.value as ErrorBarType })}><option value="sd">Sample SD</option><option value="se">Standard error</option><option value="ci">Confidence interval</option><option value="range">Range</option><option value="none">None</option></select></label>{activeLayer.errorBar === 'ci' && <label>Confidence level<select value={activeLayer.confidenceLevel ?? 0.95} onChange={(event) => updateLayer(activeLayer.id, { confidenceLevel: Number(event.target.value) })}><option value="0.8">80%</option><option value="0.9">90%</option><option value="0.95">95%</option><option value="0.99">99%</option></select></label>}<label className="toggle-row"><span>Show individual observations</span><input type="checkbox" checked={activeLayer.showObservations ?? false} onChange={(event) => updateLayer(activeLayer.id, { showObservations: event.target.checked })} /></label><small>SD uses n − 1. Confidence intervals are two-sided Student's t intervals. Groups with n = 1 show no uncertainty.</small></>}
                {activeLayer.element === 'fit' && <><label className="toggle-row"><span>Show equation</span><input type="checkbox" checked={activeLayer.showEquation ?? false} onChange={(event) => updateLayer(activeLayer.id, { showEquation: event.target.checked })} /></label><label className="toggle-row"><span>Show R²</span><input type="checkbox" checked={activeLayer.showRSquared ?? false} onChange={(event) => updateLayer(activeLayer.id, { showRSquared: event.target.checked })} /></label><label>Set y-intercept<input type="number" step="any" placeholder="Automatic" value={activeLayer.fixedIntercept ?? ''} onChange={(event) => updateLayer(activeLayer.id, { fixedIntercept: event.target.value === '' ? undefined : Number(event.target.value) })} /></label><small className="fit-intercept-help">When set, the fit line passes through this y value and recalculates its slope.</small></>}
                {activeLayer.element === 'histogram' && <label>Number of bins<input type="number" min="1" max="100" value={activeLayer.binCount ?? 10} onChange={(event) => updateLayer(activeLayer.id, { binCount: Math.max(1, Number(event.target.value)) })} /></label>}
                {activeLayer.element === 'box' && <label>Show points<select value={activeLayer.boxPoints ?? 'outliers'} onChange={(event) => updateLayer(activeLayer.id, { boxPoints: event.target.value as BoxPointMode })}><option value="outliers">Outliers only</option><option value="all">All observations</option><option value="none">None</option></select><small>Outliers use Tukey's 1.5 × IQR rule.</small></label>}
                {activeLayer.element === 'bar' && <><label>Bar summary<select value={activeLayer.barAggregation ?? 'mean'} onChange={(event) => updateLayer(activeLayer.id, { barAggregation: event.target.value as BarAggregation })}><option value="mean">Mean</option><option value="sum">Sum</option><option value="count">Count</option></select></label><label>Error bars<select value={activeLayer.errorBar ?? 'none'} disabled={(activeLayer.barAggregation ?? 'mean') !== 'mean' || !!activeLayer.stack} onChange={(event) => updateLayer(activeLayer.id, { errorBar: event.target.value as ErrorBarType })}><option value="sd">Sample SD</option><option value="se">Standard error</option><option value="ci">Confidence interval</option><option value="range">Range</option><option value="none">None</option></select></label>{activeLayer.errorBar === 'ci' && (activeLayer.barAggregation ?? 'mean') === 'mean' && !activeLayer.stack && <label>Confidence level<select value={activeLayer.confidenceLevel ?? 0.95} onChange={(event) => updateLayer(activeLayer.id, { confidenceLevel: Number(event.target.value) })}><option value="0.8">80%</option><option value="0.9">90%</option><option value="0.95">95%</option><option value="0.99">99%</option></select></label>}<small className="setting-help bar-error-help">Bar error bars describe the observations behind each mean. They are unavailable for sums, counts, and stacked bars.</small><label className="toggle-row"><span>Stack compatible series</span><input type="checkbox" disabled={!stackCheck.compatible} checked={activeLayer.stack ?? false} onChange={(event) => updateLayer(activeLayer.id, { stack: event.target.checked })} /></label>{!stackCheck.compatible && <small className="setting-warning">{stackCheck.reason}</small>}</>}
                {activeLayer.element === 'area' && <><label className="toggle-row"><span>Stack compatible series</span><input type="checkbox" disabled={!stackCheck.compatible} checked={activeLayer.stack ?? false} onChange={(event) => updateLayer(activeLayer.id, { stack: event.target.checked })} /></label>{!stackCheck.compatible && <small className="setting-warning">{stackCheck.reason}</small>}</>}
                <div className="property-grid"><label>X override<select value={activeLayer.x ?? ''} onChange={(event) => updateLayer(activeLayer.id, { x: event.target.value || undefined })}><option value="">Shared</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label><label>Y override<select value={activeLayer.y ?? ''} onChange={(event) => updateLayer(activeLayer.id, { y: event.target.value || undefined })}><option value="">Shared</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label></div>
                <label>Color override<select value={activeLayer.color ?? ''} onChange={(event) => updateLayer(activeLayer.id, { color: event.target.value || undefined })}><option value="">Shared</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label>
                <div className="property-grid"><label>Mark color<input type="color" value={activeLayer.colorHex ?? '#0f6c75'} onChange={(event) => updateLayer(activeLayer.id, { colorHex: event.target.value })} /></label><label>Marker size<input type="number" min="2" max="30" value={activeLayer.markerSize ?? spec.markerSize} onChange={(event) => updateLayer(activeLayer.id, { markerSize: Number(event.target.value) })} /></label><label>Line width<input type="number" min="1" max="8" value={activeLayer.lineWidth ?? 2.5} onChange={(event) => updateLayer(activeLayer.id, { lineWidth: Number(event.target.value) })} /></label></div>
              </div>}
            </CollapsibleSection>
            <CollapsibleSection title="Graph">
              <label>Title<input value={spec.title} onChange={(event) => updateSpec({ title: event.target.value })} /></label>
              <label>Subtitle<input value={spec.subtitle} onChange={(event) => updateSpec({ subtitle: event.target.value })} /></label>
              {spec.x.length > 1 && <label>X variables<select value={spec.xDisplay ?? 'together'} disabled={!!spec.panels?.length} onChange={(event) => updateSpec({ xDisplay: event.target.value as 'together' | 'subplots' })}><option value="together">Display together</option><option value="subplots">Subplots</option></select></label>}
              {spec.y.length > 1 && <label>Y variables<select value={spec.yDisplay ?? 'together'} disabled={!!spec.panels?.length} onChange={(event) => updateSpec({ yDisplay: event.target.value as 'together' | 'subplots' | 'collate' })}><option value="together">Display together</option><option value="subplots">Subplots</option>{canCollate && <option value="collate">Collate by category</option>}</select></label>}
              {(splitX || splitY) && !spec.panels?.length && <><label>Subplot arrangement<select value={subplotColumns === 1 ? 'vertical' : subplotColumns === axisPanelCount ? 'horizontal' : 'grid'} onChange={(event) => { const value = event.target.value; updateSpec({ subplotColumns: value === 'vertical' ? 1 : value === 'horizontal' ? axisPanelCount : Math.min(2, axisPanelCount) }) }}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>{axisPanelCount > 2 && <option value="grid">Grid</option>}</select></label>{axisPanelCount > 2 && <div className="property-grid"><label>Subplots per row<input type="number" min="1" max={axisPanelCount} value={subplotColumns} onChange={(event) => updateSpec({ subplotColumns: Math.min(axisPanelCount, Math.max(1, Number(event.target.value) || 1)) })} /></label><label>Subplots per column<input type="number" min="1" max={axisPanelCount} value={Math.ceil(axisPanelCount / subplotColumns)} onChange={(event) => updateSpec({ subplotColumns: Math.ceil(axisPanelCount / Math.min(axisPanelCount, Math.max(1, Number(event.target.value) || 1))) })} /></label></div>}<small className="setting-help">Each selected variable gets its own panel. X and Y subplot choices combine into one panel for each pair. Group X, Group Y, Wrap, and layer X/Y overrides pause while these subplots are shown.</small></>}
              {spec.yDisplay === 'collate' && canCollate && spec.y.length > 1 && <small className="setting-help">For each X category, show the Y measures side by side in one graph.</small>}
              <label>Facet scales<select value={spec.facetScale ?? 'shared'} disabled={!!spec.panels?.length} onChange={(event) => updateSpec({ facetScale: event.target.value as 'shared' | 'independent' })}><option value="shared">Shared across panels</option><option value="independent">Independent per panel</option></select></label>
              <div className="reference-heading"><strong>Custom panels</strong><button onClick={() => updateSpec({ panels: [...(spec.panels ?? []), { id: crypto.randomUUID(), title: `Panel ${(spec.panels?.length ?? 0) + 1}`, x: spec.x[0], y: spec.y[0] }] })}>+ Panel</button></div>
              {!!spec.panels?.length && <><small className="custom-panel-help">Each custom panel uses its own X and Y choices and shows all layers. Group X, Group Y, Wrap, and layer X/Y overrides are paused until you remove the custom panels. Leave X empty for a Y-only box plot. Double-click a displayed title to edit it.</small>{spec.panels.map((panel, index) => <div className="custom-panel-settings" key={panel.id}>
                <div className="reference-heading"><strong>Panel {index + 1}</strong><button aria-label={`Remove panel ${index + 1}`} onClick={() => updateSpec({ panels: spec.panels?.filter((item) => item.id !== panel.id) })}>Remove</button></div>
                <label>Panel title<input value={panel.title} onChange={(event) => updateSpec({ panels: spec.panels?.map((item) => item.id === panel.id ? { ...item, title: event.target.value } : item) })} /></label>
                <div className="property-grid"><label>Panel X<select value={panel.x ?? ''} onChange={(event) => updateSpec({ panels: spec.panels?.map((item) => item.id === panel.id ? { ...item, x: event.target.value || undefined } : item) })}><option value="">None</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label><label>Panel Y<select value={panel.y ?? ''} onChange={(event) => updateSpec({ panels: spec.panels?.map((item) => item.id === panel.id ? { ...item, y: event.target.value || undefined } : item) })}><option value="">None</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label></div>
                <div className="property-grid"><label>Panel X axis title<input value={panel.xAxisTitle ?? ''} placeholder="Use graph or column title" onChange={(event) => updateSpec({ panels: spec.panels?.map((item) => item.id === panel.id ? { ...item, xAxisTitle: event.target.value || undefined } : item) })} /></label><label>Panel Y axis title<input value={panel.yAxisTitle ?? ''} placeholder="Use graph or column title" onChange={(event) => updateSpec({ panels: spec.panels?.map((item) => item.id === panel.id ? { ...item, yAxisTitle: event.target.value || undefined } : item) })} /></label></div>
              </div>)}</>}
              <ReferenceControls spec={spec} updateSpec={updateSpec} />
            </CollapsibleSection>
            <CollapsibleSection title="Marks">
              <label className="range-label"><span>Marker size</span><output>{spec.markerSize}px</output><input type="range" min="4" max="18" value={spec.markerSize} onChange={(event) => updateSpec({ markerSize: Number(event.target.value) })} /></label>
            </CollapsibleSection>
            <CollapsibleSection title="Axes">
              <label className="toggle-row"><span>Show grid lines</span><input type="checkbox" checked={spec.showGrid} onChange={(event) => updateSpec({ showGrid: event.target.checked })} /></label>
            </CollapsibleSection>
            <AppearanceControls />
          </aside>}
        </main>
      </div>
      {showDataTable && <DataTableModal onClose={() => setShowDataTable(false)} />}
      {showPlotSetups && <PlotSetupModal onClose={() => setShowPlotSetups(false)} />}
      {showProjects && <ProjectModal onClose={() => setShowProjects(false)} autosaveStatus={recovery.status} />}
      {recovery.recovery && <div className="modal-backdrop recovery-backdrop"><section className="sheet-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title"><span className="eyebrow">LOCAL RECOVERY</span><h2 id="recovery-title">Continue your autosaved project?</h2><p>“{recovery.recovery.name}” was saved locally on {new Date(recovery.recovery.savedAt).toLocaleString()}. Restore it to continue with its data and graphs, or start with the current example. Nothing is uploaded.</p><div className="project-actions"><button onClick={recovery.restore}>Restore project</button><button onClick={() => void recovery.dismiss()}>Start with example</button></div></section></div>}
      {filterColumnId && columnFor(filterColumnId) && <FilterPopup column={columnFor(filterColumnId)!} onClose={() => setFilterColumnId(undefined)} />}
      {showActiveFilters && <ActiveFiltersPopup onClose={() => setShowActiveFilters(false)} onEdit={(columnId) => { setShowActiveFilters(false); setFilterColumnId(columnId) }} />}
      {compatibilityMessage && <div className="compatibility-message" role="alert"><span>{compatibilityMessage}</span><button onClick={clearCompatibilityMessage}>×</button></div>}
      {pngError && <div className="compatibility-message" role="alert"><span>{pngError}</span><button aria-label="Dismiss PNG error" onClick={() => setPngError(undefined)}>×</button></div>}
      {dragColumnId && <div className="drag-preview" role="status"><strong>{columnFor(dragColumnId)?.name}</strong><span>Drop on a role to assign · X and Y accept multiple variables · Size requires numeric data · Frequency requires whole-number counts</span></div>}
      {dragElement && <div className="drag-preview" role="status"><strong>{dragElement}</strong><span>Drop onto the graph to add this layer without changing role assignments</span></div>}
    </DndContext>
  )
}

export default App
