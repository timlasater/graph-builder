import { requiresYAssignment } from '../compatibility'
import { aggregateBars, histogramBins, linearFit, numericOrNaN, sortedSeries, stableCategoryOrder, stackCompatibility } from '../plotTransforms'
import { errorBarExtent, summaryStatistics } from '../statistics'
import { rowMatchesFilters, useBuilderStore } from '../store'
import type { DataColumn, DataRow, GraphLayer } from '../types'
import { PlotlyChart } from './PlotlyChart'

const palette = ['#0f6c75', '#ef8354', '#665191', '#2f4858', '#d45087', '#73a942']
const symbols = ['circle', 'square', 'diamond', 'cross', 'triangle-up', 'star', 'hexagon', 'triangle-down']
interface Facet { label?: string; row: number; column: number; rows: DataRow[] }
const uniqueValues = (rows: DataRow[], columnId?: string) => columnId ? [...new Set(rows.map((row) => String(row.values[columnId])))] : ['']
const scaleMarkerSizes = (values: unknown[], fallback: number) => {
  const numeric = values.map(Number); if (!numeric.every(Number.isFinite)) return values.map(() => fallback)
  const minimum = Math.min(...numeric); const maximum = Math.max(...numeric); if (minimum === maximum) return values.map(() => fallback)
  return numeric.map((value) => 6 + ((value - minimum) / (maximum - minimum)) * 13)
}
const columnLabel = (column: DataColumn) => `${column.name}${column.unit ? ` (${column.unit})` : ''}`

export function GraphCanvas() {
  const { dataset, spec, filters } = useBuilderStore()
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
  const data = facets.flatMap((facet, facetIndex) => spec.layers.flatMap((layer, layerIndex) => pairsFor(layer).flatMap(({ xColumn, yColumn }) => {
    const colorColumn = columnFor(layer.color ?? spec.color); const overlayColumn = columnFor(spec.overlay)
    const keys = [...new Set(facet.rows.map((row) => [colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations'))]
    return keys.map((key, traceIndex) => {
      const rows = facet.rows.filter((row) => ([colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations') === key)
      const axisNumber = facetIndex + 1; const colorKey = colorColumn ? String(rows[0]?.values[colorColumn.id]) : key; const colorIndex = Math.max(0, uniqueValues(includedRows, colorColumn?.id).indexOf(colorKey)); const color = layer.colorHex ?? palette[colorColumn ? colorIndex % palette.length : (layerIndex + traceIndex) % palette.length]
      const nameParts = [spec.layers.length > 1 && layer.name, (sharedX.length > 1 || sharedY.length > 1) && `${yColumn.name} vs ${xColumn.name}`, key].filter(Boolean)
      const legendKey = nameParts.join(' · '); const showlegend = !legendEntries.has(legendKey); legendEntries.add(legendKey)
      const base = { name: legendKey, legendgroup: legendKey, showlegend, xaxis: axisNumber === 1 ? 'x' : `x${axisNumber}`, yaxis: axisNumber === 1 ? 'y' : `y${axisNumber}`, line: { color, width: layer.lineWidth ?? 2.5, dash: overlayColumn && traceIndex % 2 ? 'dash' : 'solid' }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y}<extra></extra>` }
      if (layer.element === 'fit') {
        const fit = linearFit(rows.map((row) => numericOrNaN(row.values[xColumn.id])), rows.map((row) => numericOrNaN(row.values[yColumn.id])), weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined)
        return fit ? { ...base, type: 'scatter', mode: 'lines', x: fit.x, y: fit.y } : { ...base, type: 'scatter', mode: 'lines', x: [], y: [] }
      }
      if (layer.element === 'summary') {
        const groups = [...new Set(rows.map((row) => String(row.values[xColumn.id])))]
        const summaries = groups.map((group) => { const grouped = rows.filter((row) => String(row.values[xColumn.id]) === group); return summaryStatistics(grouped.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id])), weightColumn ? grouped.map((row) => row.values[weightColumn.id] === null ? Number.NaN : Number(row.values[weightColumn.id])) : undefined) })
        const errorType = layer.errorBar ?? 'sd'; const extents = summaries.map((summary) => errorBarExtent(summary, errorType)); const errorLabel = errorType === 'ci95' ? '95% CI' : errorType.toUpperCase()
        return { ...base, type: 'scatter', mode: 'lines+markers', x: groups, y: summaries.map((summary) => summary.mean), marker: { color, size: layer.markerSize ?? spec.markerSize }, customdata: summaries.map((summary) => [summary.n]), error_y: errorType === 'none' ? undefined : { type: 'data', visible: true, symmetric: false, array: extents.map((extent) => extent?.plus ?? 0), arrayminus: extents.map((extent) => extent?.minus ?? 0), color, thickness: 1.5, width: 4 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>Mean ${yColumn.name}: %{y:.4g}<br>n: %{customdata[0]}<br>Error bars: ${errorLabel}<extra></extra>` }
      }
      if (layer.element === 'histogram') {
        const panelValues = facet.rows.map((row) => row.values[xColumn.id] === null ? Number.NaN : Number(row.values[xColumn.id])).filter(Number.isFinite); const domain: [number, number] | undefined = panelValues.length ? [Math.min(...panelValues), Math.max(...panelValues)] : undefined
        const bins = histogramBins(rows.map((row) => numericOrNaN(row.values[xColumn.id])), layer.binCount ?? 10, domain, weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined)
        return { ...base, type: 'bar', x: bins.centers, y: bins.counts, width: bins.centers.map(() => bins.width * 0.94), marker: { color, opacity: 0.82 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>Count: %{y}<extra></extra>` }
      }
      if (layer.element === 'box') return { ...base, type: 'box', x: rows.map((row) => String(displayValue(xColumn, row.values[xColumn.id]))), y: rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id])), marker: { color, size: layer.markerSize ?? spec.markerSize }, line: { color, width: layer.lineWidth ?? 2 }, quartilemethod: 'linear', boxpoints: layer.boxPoints === 'none' ? false : layer.boxPoints ?? 'outliers', jitter: layer.boxPoints === 'all' ? 0.28 : 0, pointpos: 0, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y}<extra></extra>` }
      if (layer.element === 'bar') {
        const bars = aggregateBars(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => numericOrNaN(row.values[yColumn.id])), layer.barAggregation ?? 'mean', weightColumn ? rows.map((row) => numericOrNaN(row.values[weightColumn.id])) : undefined)
        return { ...base, type: 'bar', x: bars.map((bar) => bar.key), y: bars.map((bar) => bar.value), customdata: bars.map((bar) => [bar.n]), marker: { color, opacity: 0.84 }, hovertemplate: `<b>${legendKey}</b><br>${xColumn.name}: %{x}<br>${layer.barAggregation ?? 'mean'}: %{y:.4g}<br>n: %{customdata[0]}<extra></extra>` }
      }
      if (layer.element === 'area') {
        const series = sortedSeries(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id])))
        const stackable = layer.stack && stackCompatibility(facet.rows, xColumn.id, colorColumn?.id ?? overlayColumn?.id).compatible
        return { ...base, type: 'scatter', mode: 'lines', x: series.map((point) => point.x), y: series.map((point) => point.y), fill: 'tozeroy', stackgroup: stackable ? `stack-${facetIndex}-${xColumn.id}-${yColumn.id}` : undefined, line: { color, width: layer.lineWidth ?? 2.5 }, fillcolor: `${color}55` }
      }
      const sizeValues = sizeColumn ? rows.map((row) => row.values[sizeColumn.id]) : rows.map(() => layer.markerSize ?? spec.markerSize)
      const shapeValues = shapeColumn ? uniqueValues(includedRows, shapeColumn.id) : []
      const series = layer.element === 'line' ? sortedSeries(rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), rows.map((row) => row.values[yColumn.id] === null ? Number.NaN : Number(row.values[yColumn.id]))) : undefined
      return { ...base, type: 'scatter', mode: layer.element === 'line' ? 'lines+markers' : 'markers', x: series ? series.map((point) => point.x) : rows.map((row) => displayValue(xColumn, row.values[xColumn.id])), y: series ? series.map((point) => point.y) : rows.map((row) => displayValue(yColumn, row.values[yColumn.id])), marker: { color, size: scaleMarkerSizes(sizeValues, layer.markerSize ?? spec.markerSize), symbol: shapeColumn ? rows.map((row) => symbols[Math.max(0, shapeValues.indexOf(String(row.values[shapeColumn.id]))) % symbols.length]) : undefined, opacity: 0.82 }, customdata: rows.map((row) => row.id) }
    })
  })))

  const categoricalXLayer = spec.layers.some((layer) => layer.element === 'box' || layer.element === 'bar')
  const xCategories = sharedX.length === 1 && (sharedX[0].modelingType !== 'continuous' || categoricalXLayer) ? stableCategoryOrder(includedRows.map((row) => row.values[sharedX[0].id]), sharedX[0]) : undefined
  const yCategories = sharedY.length === 1 && sharedY[0].modelingType !== 'continuous' ? stableCategoryOrder(includedRows.map((row) => row.values[sharedY[0].id]), sharedY[0]) : undefined
  const horizontalGap = facetColumns > 1 ? 0.08 : 0; const verticalGap = facetRows > 1 ? 0.13 : 0; const cellWidth = (1 - horizontalGap * (facetColumns - 1)) / facetColumns; const cellHeight = (1 - verticalGap * (facetRows - 1)) / facetRows
  const axes: Record<string, unknown> = {}; const annotations: unknown[] = []; const shapes: unknown[] = []; const xTitle = sharedX.map(columnLabel).join(' / '); const yTitle = spec.layers.every((layer) => layer.element === 'histogram') ? 'Count' : sharedY.map(columnLabel).join(' / ')
  facets.forEach((facet, index) => {
    const number = index + 1; const xStart = facet.column * (cellWidth + horizontalGap); const yTop = 1 - facet.row * (cellHeight + verticalGap); const xKey = number === 1 ? 'xaxis' : `xaxis${number}`; const yKey = number === 1 ? 'yaxis' : `yaxis${number}`
    axes[xKey] = { domain: [xStart, xStart + cellWidth], anchor: number === 1 ? 'y' : `y${number}`, title: facet.row === facetRows - 1 ? xTitle : '', gridcolor: spec.showGrid ? '#e5e9ed' : 'transparent', zeroline: false, ...(xCategories ? { type: 'category', categoryorder: 'array', categoryarray: xCategories } : {}) }
    axes[yKey] = { domain: [yTop - cellHeight, yTop], anchor: number === 1 ? 'x' : `x${number}`, title: !groupYColumn && facet.column === 0 ? yTitle : '', gridcolor: spec.showGrid ? '#e5e9ed' : 'transparent', zeroline: false, ...(yCategories ? { type: 'category', categoryorder: 'array', categoryarray: yCategories } : {}) }
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
  return <PlotlyChart data={data} layout={{ ...axes, autosize: true, title: { text: `<b>${spec.title}</b><br><span style="font-size:12px;color:#68737d">${spec.subtitle}${pageColumn ? ` · ${pageColumn.name}: ${String(spec.pageValue ?? pageValues[0] ?? '')}` : ''}</span>`, x: 0.04, xanchor: 'left' }, annotations, shapes, paper_bgcolor: '#ffffff', plot_bgcolor: '#fbfcfd', font: { family: 'Segoe UI, sans-serif', color: '#24313a', size: 12 }, margin: { l: groupYColumn ? 148 : 66, r: 24, t: groupXColumn ? 126 : 100, b: 74 }, legend: { orientation: 'h', x: 0, y: -0.2 }, hovermode: 'closest', barmode: stackedBars ? 'stack' : 'group', bargap: 0.18 }} config={{ responsive: true, displaylogo: false, doubleClickDelay: 500, modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d'] }} />
}
