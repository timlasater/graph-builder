import { requiresYAssignment } from '../compatibility'
import { aggregateBars, histogramBins, linearFit, moveOrderedValue, numericOrNaN, orderByPreference, sortedSeries, stableCategoryOrder, stackCompatibility } from '../plotTransforms'
import { errorBarExtent, summaryStatistics } from '../statistics'
import { rowMatchesFilters, useBuilderStore } from '../store'
import type { DataColumn, DataRow, GraphLayer } from '../types'
import { PlotlyChart } from './PlotlyChart'

const palette = ['#0f6c75', '#ef8354', '#665191', '#2f4858', '#d45087', '#73a942']
const symbols = ['circle', 'square', 'diamond', 'cross', 'triangle-up', 'star', 'hexagon', 'triangle-down']
interface Facet { label?: string; row: number; column: number; rows: DataRow[] }
interface LegendItem { id: string; label: string; color: string; xColumnId: string; xCategory?: string }
const uniqueValues = (rows: DataRow[], columnId?: string) => columnId ? [...new Set(rows.map((row) => String(row.values[columnId])))] : ['']
const scaleMarkerSizes = (values: unknown[], fallback: number) => {
  const numeric = values.map(Number); if (!numeric.every(Number.isFinite)) return values.map(() => fallback)
  const minimum = Math.min(...numeric); const maximum = Math.max(...numeric); if (minimum === maximum) return values.map(() => fallback)
  return numeric.map((value) => 6 + ((value - minimum) / (maximum - minimum)) * 13)
}
const columnLabel = (column: DataColumn) => `${column.name}${column.unit ? ` (${column.unit})` : ''}`

export function GraphCanvas() {
  const { dataset, spec, filters, selectedRowIds, updateSpec, setSelectedRowIds, clearRowSelection, setRowsExcluded } = useBuilderStore()
  const validRowIds = new Set(dataset.rows.map((row) => row.id))
  const rowIdsFrom = (value: unknown): string[] => typeof value === 'string' && validRowIds.has(value) ? [value] : Array.isArray(value) ? value.flatMap(rowIdsFrom) : []
  const columnFor = (id?: string) => dataset.columns.find((column) => column.id === id)
  const sharedX = spec.x.map((id) => columnFor(id)).filter((column): column is DataColumn => Boolean(column))
  const sharedY = spec.y.map((id) => columnFor(id)).filter((column): column is DataColumn => Boolean(column))
  const groupXColumn = columnFor(spec.groupX); const groupYColumn = columnFor(spec.groupY); const wrapColumn = columnFor(spec.wrap)
  const sizeColumn = columnFor(spec.size); const weightColumn = columnFor(spec.weight); const shapeColumn = columnFor(spec.shape); const pageColumn = columnFor(spec.page)
  const pageValues = pageColumn ? [...new Map(dataset.rows.map((row) => [String(row.values[pageColumn.id]), row.values[pageColumn.id]])).values()] : []
  if (!sharedX.length || (requiresYAssignment(spec.layers) && !sharedY.length)) return <div className="empty-canvas"><div className="empty-illustration">↗</div><h2>Build a graph</h2><p>{requiresYAssignment(spec.layers) ? 'Drag one or more variables to X and Y.' : 'Drag a numeric variable to X.'}</p></div>

  const includedRows = dataset.rows.filter((row) => !row.excluded && rowMatchesFilters(row, filters) && (!pageColumn || spec.pageValue === undefined || row.values[pageColumn.id] === spec.pageValue))
  let facetRows = 1; let facetColumns = 1; let facets: Facet[]; let groupXValues = ['']; let groupYValues = ['']
  if (wrapColumn) {
    const values = uniqueValues(includedRows, wrapColumn.id); facetColumns = Math.ceil(Math.sqrt(values.length)) || 1; facetRows = Math.ceil(values.length / facetColumns) || 1
    facets = values.map((value, index) => ({ label: `${wrapColumn.name}: ${value}`, row: Math.floor(index / facetColumns), column: index % facetColumns, rows: includedRows.filter((dataRow) => String(dataRow.values[wrapColumn.id]) === value) }))
  } else {
    groupYValues = uniqueValues(includedRows, groupYColumn?.id); groupXValues = uniqueValues(includedRows, groupXColumn?.id); facetRows = groupYValues.length; facetColumns = groupXValues.length
    facets = groupYValues.flatMap((rowValue, row) => groupXValues.map((columnValue, column) => ({ row, column, rows: includedRows.filter((dataRow) => (!groupYColumn || String(dataRow.values[groupYColumn.id]) === rowValue) && (!groupXColumn || String(dataRow.values[groupXColumn.id]) === columnValue)) })))
  }
  const displayValue = (column: DataColumn, value: unknown) => column.valueLabels?.[String(value)] ?? value
  const pairsFor = (layer: GraphLayer) => {
    const x = layer.x ? [columnFor(layer.x)].filter((column): column is DataColumn => Boolean(column)) : sharedX
    if (layer.element === 'histogram') return x.map((xColumn) => ({ xColumn, yColumn: xColumn }))
    const y = layer.y ? [columnFor(layer.y)].filter((column): column is DataColumn => Boolean(column)) : sharedY
    return x.flatMap((xColumn) => y.map((yColumn) => ({ xColumn, yColumn })))
  }
  const legendEntries = new Set<string>()
  const legendItems = new Map<string, LegendItem>()
  const fitAnnotations: unknown[] = []
  const fitAnnotationCounts = new Map<number, number>()
  const data = facets.flatMap((facet, facetIndex) => spec.layers.flatMap((layer, layerIndex) => pairsFor(layer).flatMap(({ xColumn, yColumn }) => {
    const colorColumn = columnFor(layer.color ?? spec.color); const overlayColumn = columnFor(spec.overlay)
    const availableKeys = [...new Set(facet.rows.map((row) => [colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations'))]
    const legendIdFor = (key: string) => [layer.id, xColumn.id, yColumn.id, key].join('::')
    const keyByLegendId = new Map(availableKeys.map((key) => [legendIdFor(key), key]))
    const keys = orderByPreference([...keyByLegendId.keys()], spec.legendOrder).map((id) => keyByLegendId.get(id)!)
    return keys.flatMap<unknown>((key) => {
      const rows = facet.rows.filter((row) => ([colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations') === key)
      const legendId = legendIdFor(key); const axisNumber = facetIndex + 1; const colorKey = colorColumn ? String(rows[0]?.values[colorColumn.id]) : key; const colorIndex = Math.max(0, uniqueValues(includedRows, colorColumn?.id).indexOf(colorKey)); const paletteIndex = colorColumn ? colorIndex : layerIndex + Math.max(0, availableKeys.indexOf(key)); const color = spec.seriesColors?.[legendId] ?? layer.colorHex ?? palette[paletteIndex % palette.length]
      const nameParts = [spec.layers.length > 1 && layer.name, (sharedX.length > 1 || sharedY.length > 1) && `${yColumn.name} vs ${xColumn.name}`, key].filter(Boolean)
      const legendKey = nameParts.join(' · '); const showlegend = !legendEntries.has(legendKey); legendEntries.add(legendKey)
      const xValues = [...new Set(rows.map((row) => String(displayValue(xColumn, row.values[xColumn.id]))))]
      if (showlegend) legendItems.set(legendId, { id: legendId, label: legendKey, color, xColumnId: xColumn.id, xCategory: xValues.length === 1 ? xValues[0] : undefined })
      const base = { name: legendKey, legendgroup: legendKey, showlegend, visible: spec.hiddenSeries?.includes(legendId) ? 'legendonly' : true, opacity: spec.highlightedSeries && spec.highlightedSeries !== legendId ? 0.16 : 1, xaxis: axisNumber === 1 ? 'x' : `x${axisNumber}`, yaxis: axisNumber === 1 ? 'y' : `y${axisNumber}`, line: { color, width: layer.lineWidth ?? 2.5, dash: overlayColumn && availableKeys.indexOf(key) % 2 ? 'dash' : 'solid' }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y}<extra></extra>` }
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
        const summaryTrace = { ...base, type: 'scatter', mode: 'lines+markers', x: groups, y: summaries.map((summary) => summary.mean), marker: { color, size: layer.markerSize ?? spec.markerSize }, customdata: groups.map((group, index) => [summaries[index].n, rows.filter((row) => String(row.values[xColumn.id]) === group).map((row) => row.id)]), error_y: errorType === 'none' ? undefined : { type: 'data', visible: true, symmetric: false, array: extents.map((extent) => extent?.plus ?? 0), arrayminus: extents.map((extent) => extent?.minus ?? 0), color, thickness: 1.5, width: 4 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>Mean ${yColumn.name}: %{y:.4g}<br>n: %{customdata[0]}<br>Error bars: ${errorLabel}<extra></extra>` }
        if (!layer.showObservations) return summaryTrace
        const observationRows = rows.filter((row) => Number.isFinite(numericOrNaN(row.values[yColumn.id])))
        const observationTrace = { ...base, name: `${legendKey} observations`, showlegend: false, type: 'scatter', mode: 'markers', x: observationRows.map((row) => displayValue(xColumn, row.values[xColumn.id])), y: observationRows.map((row) => numericOrNaN(row.values[yColumn.id])), marker: { color, size: Math.max(4, (layer.markerSize ?? spec.markerSize) - 2), opacity: 0.48 }, customdata: observationRows.map((row) => row.id), hovertemplate: `<b>${legendKey} observation</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y:.4g}<br>Row: %{customdata}<extra></extra>` }
        return [observationTrace, summaryTrace]
      }
      if (layer.element === 'histogram') {
        const panelValues = facet.rows.map((row) => row.values[xColumn.id] === null ? Number.NaN : Number(row.values[xColumn.id])).filter(Number.isFinite); const domain: [number, number] | undefined = panelValues.length ? [Math.min(...panelValues), Math.max(...panelValues)] : undefined
        const bins = histogramBins(rows.map((row) => numericOrNaN(row.values[xColumn.id])), layer.binCount ?? 10, domain, weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined)
        return { ...base, type: 'bar', x: bins.centers, y: bins.counts, width: bins.centers.map(() => bins.width * 0.94), marker: { color, opacity: 0.82 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>Count: %{y}<extra></extra>` }
      }
      if (layer.element === 'box') return { ...base, type: 'box', x: rows.map((row) => String(displayValue(xColumn, row.values[xColumn.id]))), y: rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id])), customdata: rows.map((row) => row.id), marker: { color, size: layer.markerSize ?? spec.markerSize }, line: { color, width: layer.lineWidth ?? 2 }, quartilemethod: 'linear', boxpoints: layer.boxPoints === 'none' ? false : layer.boxPoints ?? 'outliers', jitter: layer.boxPoints === 'all' ? 0.28 : 0, pointpos: 0, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y}<br>Row: %{customdata}<extra></extra>` }
      if (layer.element === 'bar') {
        const bars = aggregateBars(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => numericOrNaN(row.values[yColumn.id])), layer.barAggregation ?? 'mean', weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined)
        return { ...base, type: 'bar', x: bars.map((bar) => bar.key), y: bars.map((bar) => bar.value), customdata: bars.map((bar) => [bar.n, rows.filter((row) => String(displayValue(xColumn, row.values[xColumn.id])) === bar.key).map((row) => row.id)]), marker: { color, opacity: 0.84 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${layer.barAggregation ?? 'mean'}: %{y:.4g}<br>n: %{customdata[0]}<extra></extra>` }
      }
      if (layer.element === 'area') {
        const series = sortedSeries(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id])))
        const stackable = layer.stack && stackCompatibility(facet.rows, xColumn.id, colorColumn?.id ?? overlayColumn?.id).compatible
        return { ...base, type: 'scatter', mode: 'lines', x: series.map((point) => point.x), y: series.map((point) => point.y), customdata: series.map((point) => rows[point.index].id), fill: 'tozeroy', stackgroup: stackable ? `stack-${facetIndex}-${xColumn.id}-${yColumn.id}` : undefined, line: { color, width: layer.lineWidth ?? 2.5 }, fillcolor: `${color}55` }
      }
      const sizeValues = sizeColumn ? rows.map((row) => row.values[sizeColumn.id]) : rows.map(() => layer.markerSize ?? spec.markerSize)
      const markerSizes = scaleMarkerSizes(sizeValues, layer.markerSize ?? spec.markerSize)
      const shapeValues = shapeColumn ? uniqueValues(includedRows, shapeColumn.id) : []
      const series = layer.element === 'line' ? sortedSeries(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id]))) : undefined
      return { ...base, type: 'scatter', mode: layer.element === 'line' ? 'lines+markers' : 'markers', x: series ? series.map((point) => point.x) : rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), y: series ? series.map((point) => point.y) : rows.map((row) => displayValue(yColumn, row.values[yColumn.id])), marker: { color, size: series ? series.map((point) => markerSizes[point.index]) : markerSizes, symbol: shapeColumn ? (series ? series.map((point) => symbols[Math.max(0, shapeValues.indexOf(String(rows[point.index].values[shapeColumn.id]))) % symbols.length]) : rows.map((row) => symbols[Math.max(0, shapeValues.indexOf(String(row.values[shapeColumn.id]))) % symbols.length])) : undefined, opacity: 0.82 }, customdata: series ? series.map((point) => rows[point.index].id) : rows.map((row) => row.id) }
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
  const toggleSeries = (id: string) => updateSpec({ hiddenSeries: spec.hiddenSeries?.includes(id) ? spec.hiddenSeries.filter((item) => item !== id) : [...(spec.hiddenSeries ?? []), id] })
  const categoricalXLayer = spec.layers.some((layer) => layer.element === 'box' || layer.element === 'bar')
  const naturalXCategories = sharedX.length === 1 && (sharedX[0].modelingType !== 'continuous' || categoricalXLayer) ? stableCategoryOrder(includedRows.map((row) => row.values[sharedX[0].id]), sharedX[0]).map(String) : undefined
  const preferredXCategories = sharedX.length === 1 ? orderedLegendItems.filter((item) => item.xColumnId === sharedX[0].id && item.xCategory !== undefined).map((item) => item.xCategory!) : []
  const xCategories = naturalXCategories ? orderByPreference(naturalXCategories, preferredXCategories) : undefined
  const yCategories = sharedY.length === 1 && sharedY[0].modelingType !== 'continuous' ? stableCategoryOrder(includedRows.map((row) => row.values[sharedY[0].id]), sharedY[0]) : undefined
  const horizontalGap = facetColumns > 1 ? 0.08 : 0; const verticalGap = facetRows > 1 ? 0.13 : 0; const cellWidth = (1 - horizontalGap * (facetColumns - 1)) / facetColumns; const cellHeight = (1 - verticalGap * (facetRows - 1)) / facetRows
  const axes: Record<string, unknown> = {}; const annotations: unknown[] = [...fitAnnotations]; const shapes: unknown[] = []; const xTitle = sharedX.map(columnLabel).join(' / '); const yTitle = spec.layers.every((layer) => layer.element === 'histogram') ? 'Count' : sharedY.map(columnLabel).join(' / ')
  facets.forEach((facet, index) => {
    const number = index + 1; const xStart = facet.column * (cellWidth + horizontalGap); const yTop = 1 - facet.row * (cellHeight + verticalGap); const xKey = number === 1 ? 'xaxis' : `xaxis${number}`; const yKey = number === 1 ? 'yaxis' : `yaxis${number}`
    axes[xKey] = { domain: [xStart, xStart + cellWidth], anchor: number === 1 ? 'y' : `y${number}`, matches: spec.facetScale !== 'independent' && number > 1 ? 'x' : undefined, title: facet.row === facetRows - 1 ? xTitle : '', gridcolor: spec.showGrid ? '#e5e9ed' : 'transparent', zeroline: false, ...(xCategories ? { type: 'category', categoryorder: 'array', categoryarray: xCategories } : {}) }
    axes[yKey] = { domain: [yTop - cellHeight, yTop], anchor: number === 1 ? 'x' : `x${number}`, matches: spec.facetScale !== 'independent' && number > 1 ? 'y' : undefined, title: !groupYColumn && facet.column === 0 ? yTitle : '', gridcolor: spec.showGrid ? '#e5e9ed' : 'transparent', zeroline: false, ...(yCategories ? { type: 'category', categoryorder: 'array', categoryarray: yCategories } : {}) }
    if (facet.label) annotations.push({ text: `<b>${facet.label}</b>`, x: xStart + cellWidth / 2, y: yTop + 0.035, xref: 'paper', yref: 'paper', showarrow: false, font: { size: 10, color: '#53656e' } })
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
  return <div className="chart-with-legend">
    <PlotlyChart data={interactiveData} layout={{ ...axes, autosize: true, dragmode: 'select', title: { text: `<b>${spec.title}</b><br><span style="font-size:12px;color:#68737d">${spec.subtitle}${pageColumn ? ` · ${pageColumn.name}: ${String(spec.pageValue ?? pageValues[0] ?? '')}` : ''}</span>`, x: 0.04, xanchor: 'left' }, annotations, shapes, paper_bgcolor: '#ffffff', plot_bgcolor: '#fbfcfd', font: { family: 'Segoe UI, sans-serif', color: '#24313a', size: 12 }, margin: { l: groupYColumn ? 148 : 66, r: 24, t: groupXColumn ? 126 : 100, b: 54 }, showlegend: false, hovermode: 'closest', barmode: stackedBars ? 'stack' : 'group', bargap: 0.18 }} config={{ responsive: true, displaylogo: false, doubleClickDelay: 500, modeBarButtonsToRemove: ['sendDataToCloud'] }} onPointClick={(value, additive) => selectCustomData([value], additive)} onSelection={(values) => selectCustomData(values)} onDeselect={clearRowSelection} />
    {selectedRowIds.length > 0 && <div className="graph-selection-bar"><strong>{selectedRowIds.length} source row{selectedRowIds.length === 1 ? '' : 's'} selected</strong><span>{selectedRowIds.slice(0, 4).join(', ')}{selectedRowIds.length > 4 ? '…' : ''}</span><button onClick={() => setRowsExcluded(selectedRowIds, true)}>Exclude</button><button onClick={() => setRowsExcluded(selectedRowIds, false)}>Include</button><button onClick={clearRowSelection}>Clear</button></div>}
    <div className="interactive-legend" role="list" aria-label="Graph series; drag to reorder"><span className="legend-help">Drag to reorder</span>{orderedLegendItems.map((item, index) => { const hidden = spec.hiddenSeries?.includes(item.id) ?? false; const highlighted = spec.highlightedSeries === item.id; return <div className={`interactive-legend-item ${hidden ? 'hidden' : ''} ${spec.highlightedSeries && !highlighted ? 'deemphasized' : ''}`} role="listitem" key={item.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => { event.preventDefault(); reorderLegend(event.dataTransfer.getData('text/plain'), item.id) }}><button className={`legend-highlight ${highlighted ? 'active' : ''}`} aria-label={`${highlighted ? 'Stop highlighting' : 'Highlight'} ${item.label}`} aria-pressed={highlighted} onClick={() => updateSpec({ highlightedSeries: highlighted ? undefined : item.id })}>●</button><input className="legend-color" type="color" value={item.color} aria-label={`Change color for ${item.label}`} title={`Change color for ${item.label}`} onChange={(event) => recolorLegend(item.id, event.currentTarget.value)} onBlur={(event) => recolorLegend(item.id, event.currentTarget.value)} onClick={(event) => event.stopPropagation()} draggable={false} /><button className="legend-label" draggable aria-pressed={!hidden} title={`${hidden ? 'Show' : 'Hide'} ${item.label}`} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id) }} onKeyDown={(event) => { const targetIndex = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : index; if (targetIndex !== index && orderedLegendItems[targetIndex]) { event.preventDefault(); reorderLegend(item.id, orderedLegendItems[targetIndex].id) } }} onClick={() => toggleSeries(item.id)}>{item.label}</button></div> })}</div>
  </div>
}
