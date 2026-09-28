import { useEffect, useRef, useState } from 'react'
import { requiresYAssignment } from '../compatibility'
import { axisConfiguration, categoryTickLayout, orderedCategories, palettes, themes } from '../appearance'
import { aggregateBars, histogramBins, linearFit, moveOrderedValue, numericOrNaN, orderByPreference, sortedSeries, stableCategoryOrder, stackCompatibility } from '../plotTransforms'
import { errorBarExtent, summaryStatistics } from '../statistics'
import { rowMatchesFilters, useBuilderStore } from '../store'
import type { DataColumn, DataRow, GraphLayer } from '../types'
import { PlotlyChart, type PlotTitleTarget } from './PlotlyChart'

const symbols = ['circle', 'square', 'diamond', 'cross', 'triangle-up', 'star', 'hexagon', 'triangle-down']
interface Facet { label?: string; row: number; column: number; rows: DataRow[]; x?: DataColumn; y?: DataColumn; custom?: boolean }
interface LegendItem { id: string; label: string; color: string; xColumnId: string; xCategory?: string }
const uniqueValues = (rows: DataRow[], columnId?: string) => columnId ? [...new Set(rows.map((row) => String(row.values[columnId])))] : ['']
const scaleMarkerSizes = (values: unknown[], fallback: number) => {
  const numeric = values.map(Number); if (!numeric.every(Number.isFinite)) return values.map(() => fallback)
  const minimum = Math.min(...numeric); const maximum = Math.max(...numeric); if (minimum === maximum) return values.map(() => fallback)
  return numeric.map((value) => 6 + ((value - minimum) / (maximum - minimum)) * 13)
}
const columnLabel = (column: DataColumn) => `${column.name}${column.unit ? ` (${column.unit})` : ''}`
const boxCategoryColumn: DataColumn = { id: '__all_observations__', name: 'All observations', dataType: 'text', modelingType: 'nominal' }

function LegendEntry({ item, index, items, hidden, highlighted, dimmed, onToggle, onReorder, onRecolor, onHighlight, onRename }: {
  item: LegendItem; index: number; items: LegendItem[]; hidden: boolean; highlighted: boolean; dimmed: boolean
  onToggle: () => void; onReorder: (source: string, target: string) => void; onRecolor: (color: string) => void; onHighlight: () => void; onRename: (name: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipBlur = useRef(false)
  const clearClick = () => { if (clickTimer.current) clearTimeout(clickTimer.current); clickTimer.current = null }
  useEffect(() => clearClick, [])
  const commitRename = () => { if (skipBlur.current) { skipBlur.current = false; return }; if (draft !== null && draft.trim() !== item.label) onRename(draft.trim()); setDraft(null) }
  return <div className={`interactive-legend-item ${hidden ? 'hidden' : ''} ${dimmed ? 'deemphasized' : ''}`} role="listitem" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => { event.preventDefault(); onReorder(event.dataTransfer.getData('text/plain'), item.id) }}>
    <button className={`legend-highlight ${highlighted ? 'active' : ''}`} aria-label={`${highlighted ? 'Stop highlighting' : 'Highlight'} ${item.label}`} aria-pressed={highlighted} onClick={onHighlight}>●</button>
    <input className="legend-color" type="color" value={item.color} aria-label={`Change color for ${item.label}`} title={`Change color for ${item.label}`} onChange={(event) => onRecolor(event.currentTarget.value)} onBlur={(event) => onRecolor(event.currentTarget.value)} onClick={(event) => event.stopPropagation()} draggable={false} />
    {draft !== null ? <input className="legend-rename" aria-label={`Rename ${item.label}`} title="Press Enter to save or Escape to cancel" value={draft} autoFocus onChange={(event) => setDraft(event.target.value)} onBlur={commitRename} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { skipBlur.current = true; setDraft(null) } }} /> : <button className="legend-label" draggable aria-pressed={!hidden} title={`${hidden ? 'Show' : 'Hide'} ${item.label}; double-click to rename; drag to reorder`} onDragStart={(event) => { clearClick(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id) }} onKeyDown={(event) => { if (event.key === 'F2') { event.preventDefault(); skipBlur.current = false; setDraft(item.label); return }; const targetIndex = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : index; if (targetIndex !== index && items[targetIndex]) { event.preventDefault(); onReorder(item.id, items[targetIndex].id) } }} onClick={(event) => { clearClick(); if (event.detail === 0) onToggle(); else if (event.detail === 1) clickTimer.current = setTimeout(onToggle, 350) }} onDoubleClick={(event) => { event.preventDefault(); clearClick(); skipBlur.current = false; setDraft(item.label) }}>{item.label}</button>}
  </div>
}

export function GraphCanvas() {
  const { dataset, spec, filters, selectedRowIds, updateSpec, setSelectedRowIds, clearRowSelection, setRowsExcluded } = useBuilderStore()
  const chartRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const cancelTitleBlur = useRef(false)
  const [editingTitle, setEditingTitle] = useState<{ kind: 'graph' | 'subtitle' | 'xAxis' | 'yAxis' | 'panel'; panelId?: string; value: string; left: number; top: number }>()
  const [titleDraft, setTitleDraft] = useState('')
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus({ preventScroll: true }) }, [editingTitle])
  const validRowIds = new Set(dataset.rows.map((row) => row.id))
  const rowIdsFrom = (value: unknown): string[] => typeof value === 'string' && validRowIds.has(value) ? [value] : Array.isArray(value) ? value.flatMap(rowIdsFrom) : []
  const columnFor = (id?: string) => dataset.columns.find((column) => column.id === id)
  const sharedX = spec.x.map((id) => columnFor(id)).filter((column): column is DataColumn => Boolean(column))
  const sharedY = spec.y.map((id) => columnFor(id)).filter((column): column is DataColumn => Boolean(column))
  const groupXColumn = columnFor(spec.groupX); const groupYColumn = columnFor(spec.groupY); const wrapColumn = columnFor(spec.wrap)
  const sizeColumn = columnFor(spec.size); const weightColumn = columnFor(spec.weight); const shapeColumn = columnFor(spec.shape); const pageColumn = columnFor(spec.page)
  const pageValues = pageColumn ? [...new Map(dataset.rows.map((row) => [String(row.values[pageColumn.id]), row.values[pageColumn.id]])).values()] : []
  const includedRows = dataset.rows.filter((row) => !row.excluded && rowMatchesFilters(row, filters) && (!pageColumn || spec.pageValue === undefined || row.values[pageColumn.id] === spec.pageValue))
  const palette: readonly string[] = spec.palette?.length ? spec.palette : palettes.standard
  const theme = themes[spec.theme ?? 'light']
  let facetRows = 1; let facetColumns = 1; let facets: Facet[]; let groupXValues = ['']; let groupYValues = ['']
  if (spec.panels?.length) {
    facetColumns = Math.ceil(Math.sqrt(spec.panels.length)); facetRows = Math.ceil(spec.panels.length / facetColumns)
    facets = spec.panels.map((panel, index) => ({ label: panel.title, row: Math.floor(index / facetColumns), column: index % facetColumns, rows: includedRows, x: columnFor(panel.x), y: columnFor(panel.y), custom: true }))
  } else if (wrapColumn) {
    const values = uniqueValues(includedRows, wrapColumn.id); facetColumns = Math.ceil(Math.sqrt(values.length)) || 1; facetRows = Math.ceil(values.length / facetColumns) || 1
    facets = values.map((value, index) => ({ label: `${wrapColumn.name}: ${value}`, row: Math.floor(index / facetColumns), column: index % facetColumns, rows: includedRows.filter((dataRow) => String(dataRow.values[wrapColumn.id]) === value) }))
  } else {
    groupYValues = uniqueValues(includedRows, groupYColumn?.id); groupXValues = uniqueValues(includedRows, groupXColumn?.id); facetRows = groupYValues.length; facetColumns = groupXValues.length
    facets = groupYValues.flatMap((rowValue, row) => groupXValues.map((columnValue, column) => ({ row, column, rows: includedRows.filter((dataRow) => (!groupYColumn || String(dataRow.values[groupYColumn.id]) === rowValue) && (!groupXColumn || String(dataRow.values[groupXColumn.id]) === columnValue)) })))
  }
  const displayValue = (column: DataColumn, value: unknown) => column.valueLabels?.[String(value)] ?? value
  const pairsFor = (layer: GraphLayer, facet: Facet) => {
    const x = facet.custom ? (facet.x ? [facet.x] : layer.element === 'box' ? [boxCategoryColumn] : []) : layer.x ? [columnFor(layer.x)].filter((column): column is DataColumn => Boolean(column)) : sharedX.length ? sharedX : layer.element === 'box' ? [boxCategoryColumn] : []
    if (layer.element === 'histogram') return x.map((xColumn) => ({ xColumn, yColumn: xColumn }))
    const y = facet.custom ? (facet.y ? [facet.y] : []) : layer.y ? [columnFor(layer.y)].filter((column): column is DataColumn => Boolean(column)) : sharedY
    return x.flatMap((xColumn) => y.map((yColumn) => ({ xColumn, yColumn })))
  }
  if (!facets.some((facet) => spec.layers.some((layer) => pairsFor(layer, facet).length))) return <div className="empty-canvas"><div className="empty-illustration">↗</div><h2>Build a graph</h2><p>{requiresYAssignment(spec.layers) ? 'Assign Y, and X for plots other than a Y-only box plot.' : 'Assign a numeric variable to X.'}</p></div>
  const legendEntries = new Set<string>()
  const legendItems = new Map<string, LegendItem>()
  const fitAnnotations: unknown[] = []
  const fitAnnotationCounts = new Map<number, number>()
  const data = facets.flatMap((facet, facetIndex) => spec.layers.flatMap((layer, layerIndex) => pairsFor(layer, facet).flatMap(({ xColumn, yColumn }) => {
    const colorColumn = columnFor(layer.color ?? spec.color); const overlayColumn = columnFor(spec.overlay)
    const availableKeys = [...new Set(facet.rows.map((row) => [colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations'))]
    const legendIdFor = (key: string) => [layer.id, xColumn.id, yColumn.id, key].join('::')
    const keyByLegendId = new Map(availableKeys.map((key) => [legendIdFor(key), key]))
    const keys = orderByPreference([...keyByLegendId.keys()], spec.legendOrder).map((id) => keyByLegendId.get(id)!)
    return keys.flatMap<unknown>((key) => {
      const rows = facet.rows.filter((row) => ([colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations') === key)
      const legendId = legendIdFor(key); const axisNumber = facetIndex + 1; const colorKey = colorColumn ? String(rows[0]?.values[colorColumn.id]) : key; const colorIndex = Math.max(0, uniqueValues(includedRows, colorColumn?.id).indexOf(colorKey)); const paletteIndex = colorColumn ? colorIndex : layerIndex + Math.max(0, availableKeys.indexOf(key)); const color = spec.seriesColors?.[legendId] ?? layer.colorHex ?? palette[paletteIndex % palette.length]
      const nameParts = [facet.custom && facet.label, spec.layers.length > 1 && layer.name, (facet.custom || sharedX.length > 1 || sharedY.length > 1) && `${yColumn.name} vs ${xColumn.name}`, key].filter(Boolean)
      const legendKey = spec.seriesNames?.[legendId] || nameParts.join(' · '); const showlegend = !legendEntries.has(legendId); legendEntries.add(legendId)
      const xValues = [...new Set(rows.map((row) => xColumn === boxCategoryColumn ? boxCategoryColumn.name : String(displayValue(xColumn, row.values[xColumn.id]))))]
      if (showlegend) legendItems.set(legendId, { id: legendId, label: legendKey, color, xColumnId: xColumn.id, xCategory: xValues.length === 1 ? xValues[0] : undefined })
      const base = { name: legendKey, legendgroup: legendId, showlegend, visible: spec.hiddenSeries?.includes(legendId) ? 'legendonly' : true, opacity: spec.highlightedSeries && spec.highlightedSeries !== legendId ? 0.16 : 1, xaxis: axisNumber === 1 ? 'x' : `x${axisNumber}`, yaxis: axisNumber === 1 ? 'y' : `y${axisNumber}`, line: { color, width: layer.lineWidth ?? 2.5, dash: layer.lineStyle ?? spec.lineStyle ?? (overlayColumn && availableKeys.indexOf(key) % 2 ? 'dash' : 'solid') }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y}<extra></extra>` }
      if (layer.element === 'fit') {
        const fit = linearFit(rows.map((row) => numericOrNaN(row.values[xColumn.id])), rows.map((row) => numericOrNaN(row.values[yColumn.id])), weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined, layer.fixedIntercept)
        if (fit && (layer.showEquation || layer.showRSquared)) {
          const parts = []
          if (layer.showEquation) {
            const slopeText = Number(fit.slope.toPrecision(4)).toString()
            const interceptText = Number(Math.abs(fit.intercept).toPrecision(4)).toString()
            parts.push(`ŷ = ${slopeText}x ${fit.intercept < 0 ? '−' : '+'} ${interceptText}`)
          }
          if (layer.showRSquared && fit.rSquared !== undefined) parts.push(`R² = ${Number(fit.rSquared.toPrecision(4))}`)
          const position = fitAnnotationCounts.get(facetIndex) ?? 0
          fitAnnotationCounts.set(facetIndex, position + 1)
          if (parts.length) fitAnnotations.push({ text: parts.join('<br>'), x: 0.02, y: 0.98 - position * 0.12, xref: axisNumber === 1 ? 'x domain' : `x${axisNumber} domain`, yref: axisNumber === 1 ? 'y domain' : `y${axisNumber} domain`, xanchor: 'left', yanchor: 'top', showarrow: false, align: 'left', bgcolor: '#ffffffdd', borderpad: 3, font: { size: 10, color } })
        }
        return fit ? { ...base, type: 'scatter', mode: 'lines', x: fit.x, y: fit.y } : { ...base, type: 'scatter', mode: 'lines', x: [], y: [] }
      }
      if (layer.element === 'summary') {
        const groups = [...new Set(rows.map((row) => String(row.values[xColumn.id])))]
        const confidence = layer.confidenceLevel ?? 0.95
        const summaries = groups.map((group) => { const grouped = rows.filter((row) => String(row.values[xColumn.id]) === group); return summaryStatistics(grouped.map((row) => numericOrNaN(row.values[yColumn.id])), weightColumn ? grouped.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined, confidence) })
        const errorType = layer.errorBar ?? 'sd'; const extents = summaries.map((summary) => errorBarExtent(summary, errorType)); const errorLabel = errorType === 'ci' ? `${Math.round(confidence * 100)}% CI` : errorType.toUpperCase()
        const summaryTrace = { ...base, type: 'scatter', mode: 'lines+markers', x: groups, y: summaries.map((summary) => summary.mean), marker: { color, size: layer.markerSize ?? spec.markerSize, symbol: layer.markerShape ?? spec.markerShape ?? 'circle', opacity: spec.markerOpacity ?? 0.82 }, customdata: groups.map((group, index) => [summaries[index].n, rows.filter((row) => String(row.values[xColumn.id]) === group).map((row) => row.id)]), error_y: errorType === 'none' ? undefined : { type: 'data', visible: true, symmetric: false, array: extents.map((extent) => extent?.plus ?? 0), arrayminus: extents.map((extent) => extent?.minus ?? 0), color: layer.errorColor ?? spec.errorColor ?? color, thickness: layer.errorThickness ?? spec.errorThickness ?? 1.5, width: layer.errorCap ?? spec.errorCap ?? 4 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>Mean ${yColumn.name}: %{y:.4g}<br>n: %{customdata[0]}<br>Error bars: ${errorLabel}<extra></extra>` }
        if (!layer.showObservations) return summaryTrace
        const observationRows = rows.filter((row) => Number.isFinite(numericOrNaN(row.values[yColumn.id])))
        const observationTrace = { ...base, name: `${legendKey} observations`, showlegend: false, type: 'scatter', mode: 'markers', x: observationRows.map((row) => displayValue(xColumn, row.values[xColumn.id])), y: observationRows.map((row) => numericOrNaN(row.values[yColumn.id])), marker: { color, size: Math.max(4, (layer.markerSize ?? spec.markerSize) - 2), opacity: Math.min(0.48, spec.markerOpacity ?? 0.48) }, customdata: observationRows.map((row) => row.id), hovertemplate: `<b>${legendKey} observation</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y:.4g}<br>Row: %{customdata}<extra></extra>` }
        return [observationTrace, summaryTrace]
      }
      if (layer.element === 'histogram') {
        const panelValues = facet.rows.map((row) => row.values[xColumn.id] === null ? Number.NaN : Number(row.values[xColumn.id])).filter(Number.isFinite); const domain: [number, number] | undefined = panelValues.length ? [Math.min(...panelValues), Math.max(...panelValues)] : undefined
        const bins = histogramBins(rows.map((row) => numericOrNaN(row.values[xColumn.id])), layer.binCount ?? 10, domain, weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined)
        return { ...base, type: 'bar', x: bins.centers, y: bins.counts, width: bins.centers.map(() => bins.width * (spec.barWidth ?? 0.94)), marker: { color, opacity: spec.markerOpacity ?? 0.82 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>Count: %{y}<extra></extra>` }
      }
      if (layer.element === 'box') return { ...base, type: 'box', x: rows.map((row) => xColumn === boxCategoryColumn ? boxCategoryColumn.name : String(displayValue(xColumn, row.values[xColumn.id]))), y: rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id])), customdata: rows.map((row) => row.id), marker: { color, size: layer.markerSize ?? spec.markerSize, symbol: layer.markerShape ?? spec.markerShape ?? 'circle', opacity: spec.markerOpacity ?? 0.82 }, line: { color, width: layer.lineWidth ?? 2 }, quartilemethod: 'linear', boxpoints: layer.boxPoints === 'none' ? false : layer.boxPoints ?? 'outliers', jitter: layer.boxPoints === 'all' ? spec.markerJitter ?? 0.28 : 0, pointpos: 0, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y}<br>Row: %{customdata}<extra></extra>` }
      if (layer.element === 'bar') {
        const bars = aggregateBars(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => numericOrNaN(row.values[yColumn.id])), layer.barAggregation ?? 'mean', weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined)
        return { ...base, type: 'bar', x: bars.map((bar) => bar.key), y: bars.map((bar) => bar.value), width: spec.barWidth, customdata: bars.map((bar) => [bar.n, rows.filter((row) => String(displayValue(xColumn, row.values[xColumn.id])) === bar.key).map((row) => row.id)]), marker: { color, opacity: spec.markerOpacity ?? 0.84 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${layer.barAggregation ?? 'mean'}: %{y:.4g}<br>n: %{customdata[0]}<extra></extra>` }
      }
      if (layer.element === 'area') {
        const series = sortedSeries(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id])))
        const stackable = layer.stack && stackCompatibility(facet.rows, xColumn.id, colorColumn?.id ?? overlayColumn?.id).compatible
        return { ...base, type: 'scatter', mode: 'lines', x: series.map((point) => point.x), y: series.map((point) => point.y), customdata: series.map((point) => rows[point.index].id), fill: 'tozeroy', stackgroup: stackable ? `stack-${facetIndex}-${xColumn.id}-${yColumn.id}` : undefined, fillcolor: `${color}55` }
      }
      const sizeValues = sizeColumn ? rows.map((row) => row.values[sizeColumn.id]) : rows.map(() => layer.markerSize ?? spec.markerSize)
      const markerSizes = scaleMarkerSizes(sizeValues, layer.markerSize ?? spec.markerSize)
      const shapeValues = shapeColumn ? uniqueValues(includedRows, shapeColumn.id) : []
      const series = layer.element === 'line' ? sortedSeries(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id]))) : undefined
      return { ...base, type: 'scatter', mode: layer.element === 'line' ? 'lines+markers' : 'markers', x: series ? series.map((point) => point.x) : rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), y: series ? series.map((point) => point.y) : rows.map((row) => displayValue(yColumn, row.values[yColumn.id])), marker: { color, size: series ? series.map((point) => markerSizes[point.index]) : markerSizes, symbol: shapeColumn ? (series ? series.map((point) => symbols[Math.max(0, shapeValues.indexOf(String(rows[point.index].values[shapeColumn.id]))) % symbols.length]) : rows.map((row) => symbols[Math.max(0, shapeValues.indexOf(String(row.values[shapeColumn.id]))) % symbols.length])) : layer.markerShape ?? spec.markerShape ?? 'circle', opacity: spec.markerOpacity ?? 0.82 }, customdata: series ? series.map((point) => rows[point.index].id) : rows.map((row) => row.id) }
    })
  })))

  const selectedSet = new Set(selectedRowIds)
  const interactiveData = (data as Record<string, unknown>[]).map((trace) => {
    const customData = Array.isArray(trace.customdata) ? trace.customdata : []
    const selectedpoints = selectedRowIds.length ? customData.map((value, index) => rowIdsFrom(value).some((id) => selectedSet.has(id)) ? index : -1).filter((index) => index >= 0) : undefined
    return { ...trace, selectedpoints, selected: { marker: { opacity: 1, line: { color: '#102f3a', width: 2 } } }, unselected: selectedRowIds.length ? { marker: { opacity: 0.22 } } : undefined }
  })
  const selectCustomData = (values: unknown[], additive = false) => {
    const ids = [...new Set(values.flatMap(rowIdsFrom))]
    setSelectedRowIds(additive ? [...selectedRowIds, ...ids] : ids)
  }
  const orderedLegendItems = orderByPreference([...legendItems.keys()], spec.legendOrder).map((id) => legendItems.get(id)!)
  const reorderLegend = (source: string, target: string) => updateSpec({ legendOrder: moveOrderedValue(orderedLegendItems.map((item) => item.id), source, target) })
  const recolorLegend = (id: string, color: string) => { if (spec.seriesColors?.[id] !== color) updateSpec({ seriesColors: { ...spec.seriesColors, [id]: color } }) }
  const toggleSeries = (id: string) => { const hidden = useBuilderStore.getState().spec.hiddenSeries ?? []; updateSpec({ hiddenSeries: hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id] }) }
  const renameSeries = (id: string, name: string) => { const seriesNames = { ...useBuilderStore.getState().spec.seriesNames }; if (name) seriesNames[id] = name; else delete seriesNames[id]; updateSpec({ seriesNames }) }
  const horizontalGap = facetColumns > 1 ? 0.08 : 0; const verticalGap = facetRows > 1 ? spec.panels?.length ? 0.18 : 0.13 : 0; const cellWidth = (1 - horizontalGap * (facetColumns - 1)) / facetColumns; const cellHeight = (1 - verticalGap * (facetRows - 1)) / facetRows
  const axes: Record<string, unknown> = {}; const annotations: unknown[] = [...fitAnnotations]; const panelTitleAnnotations = new Map<number, string>(); const shapes: unknown[] = []
  let axisError: string | undefined; let hasCategoricalX = false
  facets.forEach((facet, index) => {
    const number = index + 1; const xStart = facet.column * (cellWidth + horizontalGap); const yTop = 1 - facet.row * (cellHeight + verticalGap); const xKey = number === 1 ? 'xaxis' : `xaxis${number}`; const yKey = number === 1 ? 'yaxis' : `yaxis${number}`
    const xColumn = facet.custom ? facet.x : sharedX.length === 1 ? sharedX[0] : undefined
    const yColumn = facet.custom ? facet.y : sharedY.length === 1 ? sharedY[0] : undefined
    const categoricalX = !xColumn && spec.layers.some((layer) => layer.element === 'box')
    const naturalXCategories = categoricalX ? [boxCategoryColumn.name] : xColumn && (xColumn.modelingType !== 'continuous' || spec.layers.some((layer) => layer.element === 'box' || layer.element === 'bar')) ? stableCategoryOrder(includedRows.map((row) => row.values[xColumn.id]), xColumn).map(String) : undefined
    const preferredXCategories = xColumn ? orderedLegendItems.filter((item) => item.xColumnId === xColumn.id && item.xCategory !== undefined).map((item) => item.xCategory!) : []
    const xCategories = naturalXCategories && xColumn ? orderedCategories(includedRows, xColumn, spec, preferredXCategories, yColumn?.id) : naturalXCategories
    const yCategories = yColumn && yColumn.modelingType !== 'continuous' ? stableCategoryOrder(includedRows.map((row) => row.values[yColumn.id]), yColumn).map(String) : undefined
    hasCategoricalX ||= Boolean(xCategories)
    const panelTraces = (data as { xaxis?: string; x?: unknown[]; y?: unknown[] }[]).filter((trace) => (trace.xaxis ?? 'x') === (number === 1 ? 'x' : `x${number}`))
    const plottedValues = (axis: 'x' | 'y') => panelTraces.flatMap((trace) => (trace[axis] ?? []).filter((value): value is string | number | boolean | null => value === null || ['string', 'number', 'boolean'].includes(typeof value)))
    const xAxis = axisConfiguration(spec.xAxis, plottedValues('x'), xCategories ? 'category' : xColumn?.dataType === 'date' ? 'date' : 'number', xCategories)
    const yAxis = axisConfiguration(spec.yAxis, plottedValues('y'), yCategories ? 'category' : yColumn?.dataType === 'date' ? 'date' : 'number', yCategories)
    axisError ??= xAxis.error ? `Panel ${number} X axis: ${xAxis.error}` : yAxis.error ? `Panel ${number} Y axis: ${yAxis.error}` : undefined
    const xTitle = (facet.custom ? spec.panels?.[index]?.xAxisTitle : undefined) || spec.xAxis?.title || (facet.custom ? xColumn ? columnLabel(xColumn) : boxCategoryColumn.name : sharedX.length ? sharedX.map(columnLabel).join(' / ') : boxCategoryColumn.name)
    const yTitle = (facet.custom ? spec.panels?.[index]?.yAxisTitle : undefined) || spec.yAxis?.title || (facet.custom ? yColumn ? columnLabel(yColumn) : spec.layers.every((layer) => layer.element === 'histogram') ? 'Count' : '' : spec.layers.every((layer) => layer.element === 'histogram') ? 'Count' : sharedY.map(columnLabel).join(' / '))
    axes[xKey] = { ...xAxis.axis, ...categoryTickLayout(xCategories), domain: [xStart, xStart + cellWidth], anchor: number === 1 ? 'y' : `y${number}`, matches: !facet.custom && spec.facetScale !== 'independent' && number > 1 ? 'x' : undefined, title: { text: facet.custom || facet.row === facetRows - 1 ? xTitle : '', standoff: 12 }, gridcolor: spec.showGrid ? theme.grid : 'transparent', zeroline: false }
    axes[yKey] = { ...yAxis.axis, domain: [yTop - cellHeight, yTop], anchor: number === 1 ? 'x' : `x${number}`, matches: !facet.custom && spec.facetScale !== 'independent' && number > 1 ? 'y' : undefined, title: { text: facet.custom || (!groupYColumn && facet.column === 0) ? yTitle : '', standoff: 12 }, gridcolor: spec.showGrid ? theme.grid : 'transparent', zeroline: false }
    if (facet.label) { if (facet.custom) panelTitleAnnotations.set(annotations.length, spec.panels![index].id); annotations.push({ text: `<b>${facet.label}</b>`, x: 0.5, y: 1.04, xref: number === 1 ? 'x domain' : `x${number} domain`, yref: number === 1 ? 'y domain' : `y${number} domain`, xanchor: 'center', yanchor: 'bottom', showarrow: false, font: { size: 10, color: '#53656e' } }) }
    const xRef = number === 1 ? 'x' : `x${number}`; const yRef = number === 1 ? 'y' : `y${number}`
    spec.referenceLines?.forEach((line) => {
      const shape = line.axis === 'x'
        ? { type: 'line', xref: xRef, yref: `${yRef} domain`, x0: line.value, x1: line.value, y0: 0, y1: 1, line: { color: line.color, width: 2, dash: 'dash' } }
        : { type: 'line', xref: `${xRef} domain`, yref: yRef, x0: 0, x1: 1, y0: line.value, y1: line.value, line: { color: line.color, width: 2, dash: 'dash' } }
      shapes.push(shape)
      if (line.label) annotations.push(line.axis === 'x' ? { text: line.label, x: line.value, y: 0.98, xref: xRef, yref: `${yRef} domain`, showarrow: false, xanchor: 'left', font: { size: 10, color: line.color } } : { text: line.label, x: 0.98, y: line.value, xref: `${xRef} domain`, yref: yRef, showarrow: false, xanchor: 'right', font: { size: 10, color: line.color } })
    })
    spec.referenceRegions?.forEach((region) => {
      const shape = region.axis === 'x'
        ? { type: 'rect', xref: xRef, yref: `${yRef} domain`, x0: region.min, x1: region.max, y0: 0, y1: 1, fillcolor: `${region.color}28`, line: { width: 0 }, layer: 'below' }
        : { type: 'rect', xref: `${xRef} domain`, yref: yRef, x0: 0, x1: 1, y0: region.min, y1: region.max, fillcolor: `${region.color}28`, line: { width: 0 }, layer: 'below' }
      shapes.push(shape)
      if (region.label) annotations.push(region.axis === 'x' ? { text: region.label, x: (region.min + region.max) / 2, y: 0.98, xref: xRef, yref: `${yRef} domain`, showarrow: false, font: { size: 10, color: region.color } } : { text: region.label, x: 0.98, y: (region.min + region.max) / 2, xref: `${xRef} domain`, yref: yRef, showarrow: false, xanchor: 'right', font: { size: 10, color: region.color } })
    })
  })
  if (!wrapColumn && groupXColumn) groupXValues.forEach((value, column) => annotations.push({ text: `<b>${value}</b>`, x: column * (cellWidth + horizontalGap) + cellWidth / 2, y: 1.035, xref: 'paper', yref: 'paper', showarrow: false, bgcolor: '#eef3f4', bordercolor: '#d7e0e3', borderpad: 4, font: { size: 11, color: '#40545e' } }))
  if (!wrapColumn && groupYColumn) groupYValues.forEach((value, row) => annotations.push({ text: `<b>${value}</b>`, x: -0.075, y: 1 - row * (cellHeight + verticalGap) - cellHeight / 2, xref: 'paper', yref: 'paper', xanchor: 'right', showarrow: false, bgcolor: '#eef3f4', bordercolor: '#d7e0e3', borderpad: 4, font: { size: 11, color: '#40545e' } }))
  const stackedBars = spec.layers.some((layer) => layer.element === 'bar' && layer.stack && stackCompatibility(includedRows, layer.x ?? spec.x[0], layer.color ?? spec.color ?? spec.overlay).compatible)
  const beginTitleEdit = ({ kind, axisNumber, annotationIndex, text, rect }: PlotTitleTarget) => {
    const panelId = kind === 'annotation' ? panelTitleAnnotations.get(annotationIndex ?? -1) : axisNumber ? spec.panels?.[axisNumber - 1]?.id : undefined
    if (kind === 'annotation' && !panelId) return
    const editKind = kind === 'annotation' ? 'panel' : kind
    const panel = spec.panels?.find((item) => item.id === panelId)
    const value = editKind === 'graph' ? spec.title : editKind === 'subtitle' ? spec.subtitle : editKind === 'xAxis' ? panel?.xAxisTitle || spec.xAxis?.title || text : editKind === 'yAxis' ? panel?.yAxisTitle || spec.yAxis?.title || text : panel?.title ?? text
    const bounds = chartRef.current?.getBoundingClientRect()
    if (!bounds) return
    const left = Math.max(135, Math.min(bounds.width - 135, rect.left - bounds.left + rect.width / 2))
    const top = Math.max(24, Math.min(bounds.height - 24, rect.top - bounds.top + rect.height / 2))
    cancelTitleBlur.current = false
    setEditingTitle({ kind: editKind, panelId, value, left, top }); setTitleDraft(value)
  }
  const commitTitle = () => {
    if (!editingTitle || cancelTitleBlur.current) { cancelTitleBlur.current = false; return }
    const title = titleDraft.trim()
    if ((title || editingTitle.kind === 'subtitle') && title !== editingTitle.value) {
      if (editingTitle.kind === 'graph') updateSpec({ title })
      if (editingTitle.kind === 'subtitle') updateSpec({ subtitle: title })
      if (editingTitle.kind === 'panel') updateSpec({ panels: spec.panels?.map((panel) => panel.id === editingTitle.panelId ? { ...panel, title } : panel) })
      if (editingTitle.kind === 'xAxis') {
        if (editingTitle.panelId) updateSpec({ panels: spec.panels?.map((panel) => panel.id === editingTitle.panelId ? { ...panel, xAxisTitle: title } : panel) })
        else updateSpec({ xAxis: { ...spec.xAxis, title } })
      }
      if (editingTitle.kind === 'yAxis') {
        if (editingTitle.panelId) updateSpec({ panels: spec.panels?.map((panel) => panel.id === editingTitle.panelId ? { ...panel, yAxisTitle: title } : panel) })
        else updateSpec({ yAxis: { ...spec.yAxis, title } })
      }
    }
    setEditingTitle(undefined)
  }
  return <div ref={chartRef} className={`chart-with-legend legend-${spec.legendPlacement ?? 'bottom'}`} style={{ background: theme.paper }}>
    {axisError && <div className="axis-error" role="alert">{axisError}</div>}
    {!axisError && <PlotlyChart data={interactiveData} layout={{ ...axes, autosize: true, dragmode: 'select', clickmode: 'event+select', title: { text: `<b>${spec.title}</b><br><span style="font-size:12px">${spec.subtitle}${pageColumn ? ` · ${pageColumn.name}: ${String(spec.pageValue ?? pageValues[0] ?? '')}` : ''}</span>`, x: 0.04, xanchor: 'left' }, annotations, shapes, paper_bgcolor: theme.paper, plot_bgcolor: theme.plot, font: { family: spec.fontFamily ?? 'Segoe UI, sans-serif', color: theme.ink, size: spec.fontSize ?? 12 }, margin: { l: groupYColumn && !spec.panels?.length ? 148 : 66, r: 24, t: groupXColumn && !spec.panels?.length ? 126 : 100, b: hasCategoricalX ? 72 : 54, autoexpand: true }, showlegend: false, hovermode: 'closest', barmode: stackedBars ? 'stack' : 'group', bargap: spec.barGap ?? 0.18 }} config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud'] }} legendPlacement={spec.legendPlacement ?? 'bottom'} onTitleDoubleClick={beginTitleEdit} suspendRender={Boolean(editingTitle)} onPointClick={(value, additive) => selectCustomData([value], additive)} onSelection={(values) => selectCustomData(values)} onDeselect={clearRowSelection} />}
    {editingTitle && <input ref={titleInputRef} className="chart-title-editor" aria-label={editingTitle.kind === 'subtitle' ? 'Edit graph subtitle' : `Edit ${editingTitle.kind === 'panel' ? 'subplot' : editingTitle.kind === 'graph' ? 'graph' : editingTitle.kind === 'xAxis' ? 'X axis' : 'Y axis'} title`} style={{ left: editingTitle.left, top: editingTitle.top }} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onBlur={commitTitle} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancelTitleBlur.current = true; setEditingTitle(undefined) } }} />}
    {selectedRowIds.length > 0 && <div className="graph-selection-bar"><strong>{selectedRowIds.length} source row{selectedRowIds.length === 1 ? '' : 's'} selected</strong><span>{selectedRowIds.slice(0, 4).join(', ')}{selectedRowIds.length > 4 ? '…' : ''}</span><button onClick={() => setRowsExcluded(selectedRowIds, true)}>Exclude</button><button onClick={() => setRowsExcluded(selectedRowIds, false)}>Include</button><button onClick={clearRowSelection}>Clear</button></div>}
    <div className="interactive-legend" style={{ background: theme.paper, color: theme.ink }} role="list" aria-label="Graph series; drag to reorder"><span className="legend-help">Drag to reorder · Double-click a name to rename</span>{orderedLegendItems.map((item, index) => <LegendEntry key={item.id} item={item} index={index} items={orderedLegendItems} hidden={spec.hiddenSeries?.includes(item.id) ?? false} highlighted={spec.highlightedSeries === item.id} dimmed={Boolean(spec.highlightedSeries && spec.highlightedSeries !== item.id)} onToggle={() => toggleSeries(item.id)} onReorder={reorderLegend} onRecolor={(color) => recolorLegend(item.id, color)} onHighlight={() => updateSpec({ highlightedSeries: spec.highlightedSeries === item.id ? undefined : item.id })} onRename={(name) => renameSeries(item.id, name)} />)}</div>
  </div>
}
