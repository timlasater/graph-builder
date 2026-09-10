import { useBuilderStore } from '../store'
import type { DataRow } from '../types'
import { PlotlyChart } from './PlotlyChart'

const palette = ['#0f6c75', '#ef8354', '#665191', '#2f4858', '#d45087', '#73a942']

interface Facet {
  label?: string
  row: number
  column: number
  rows: DataRow[]
}

const uniqueValues = (rows: DataRow[], columnId?: string) =>
  columnId ? [...new Set(rows.map((row) => String(row.values[columnId])))] : ['']

const scaleMarkerSizes = (values: unknown[], fallback: number) => {
  const numeric = values.map(Number)
  if (!numeric.every(Number.isFinite)) return values.map(() => fallback)
  const minimum = Math.min(...numeric)
  const maximum = Math.max(...numeric)
  if (minimum === maximum) return values.map(() => fallback)
  return numeric.map((value) => 6 + ((value - minimum) / (maximum - minimum)) * 13)
}

export function GraphCanvas() {
  const { dataset, spec } = useBuilderStore()
  const columnFor = (id?: string) => dataset.columns.find((column) => column.id === id)
  const xColumn = columnFor(spec.x)
  const yColumn = columnFor(spec.y)
  const colorColumn = columnFor(spec.color)
  const overlayColumn = columnFor(spec.overlay)
  const sizeColumn = columnFor(spec.size)
  const groupXColumn = columnFor(spec.groupX)
  const groupYColumn = columnFor(spec.groupY)
  const wrapColumn = columnFor(spec.wrap)
  const colorIsFacet = Boolean(colorColumn && [groupXColumn?.id, groupYColumn?.id, wrapColumn?.id].includes(colorColumn.id))

  if (!xColumn || !yColumn) {
    return <div className="empty-canvas"><div className="empty-illustration">↗</div><h2>Build a graph</h2><p>Drag one variable to X and another to Y.</p></div>
  }

  const includedRows = dataset.rows.filter((row) => !row.excluded)
  let facetRows = 1
  let facetColumns = 1
  let facets: Facet[]
  let groupXValues = ['']
  let groupYValues = ['']

  if (wrapColumn) {
    const values = uniqueValues(includedRows, wrapColumn.id)
    facetColumns = Math.ceil(Math.sqrt(values.length))
    facetRows = Math.ceil(values.length / facetColumns)
    facets = values.map((value, index) => ({
      label: `${wrapColumn.name}: ${value}`,
      row: Math.floor(index / facetColumns),
      column: index % facetColumns,
      rows: includedRows.filter((dataRow) => String(dataRow.values[wrapColumn.id]) === value),
    }))
  } else {
    groupYValues = uniqueValues(includedRows, groupYColumn?.id)
    groupXValues = uniqueValues(includedRows, groupXColumn?.id)
    facetRows = groupYValues.length
    facetColumns = groupXValues.length
    facets = groupYValues.flatMap((rowValue, row) => groupXValues.map((columnValue, column) => ({
      row,
      column,
      rows: includedRows.filter((dataRow) =>
        (!groupYColumn || String(dataRow.values[groupYColumn.id]) === rowValue) &&
        (!groupXColumn || String(dataRow.values[groupXColumn.id]) === columnValue)),
    })))
  }

  const traceKeys = (rows: DataRow[]) => [...new Set(rows.map((row) =>
    [colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations'))]

  const data = facets.flatMap((facet, facetIndex) => traceKeys(facet.rows).map((traceKey, traceIndex) => {
    const rows = facet.rows.filter((row) => {
      const key = [colorColumn && String(row.values[colorColumn.id]), overlayColumn && String(row.values[overlayColumn.id])].filter(Boolean).join(' · ') || 'All observations'
      return key === traceKey
    })
    const axisNumber = facetIndex + 1
    const colorKey = colorColumn ? String(rows[0]?.values[colorColumn.id]) : traceKey
    const allColorValues = uniqueValues(includedRows, colorColumn?.id)
    const colorIndex = Math.max(0, allColorValues.indexOf(colorKey))
    const color = palette[colorColumn ? colorIndex % palette.length : traceIndex % palette.length]
    const sizeValues = sizeColumn ? rows.map((row) => row.values[sizeColumn.id]) : rows.map(() => spec.markerSize)
    return {
      type: spec.element === 'bar' ? 'bar' : 'scatter',
      mode: spec.element === 'line' ? 'lines+markers' : 'markers',
      name: traceKey,
      legendgroup: traceKey,
      showlegend: !colorIsFacet && facetIndex === 0,
      xaxis: axisNumber === 1 ? 'x' : `x${axisNumber}`,
      yaxis: axisNumber === 1 ? 'y' : `y${axisNumber}`,
      x: rows.map((row) => row.values[xColumn.id]),
      y: rows.map((row) => row.values[yColumn.id]),
      marker: { color, size: scaleMarkerSizes(sizeValues, spec.markerSize), opacity: 0.82 },
      line: { color, width: 2.5, dash: overlayColumn && traceIndex % 2 ? 'dash' : 'solid' },
      customdata: rows.map((row) => row.id),
      hovertemplate: `<b>${traceKey}</b><br>${xColumn.name}: %{x}<br>${yColumn.name}: %{y}${sizeColumn ? `<br>${sizeColumn.name}: %{marker.size:.1f}` : ''}<extra></extra>`,
    }
  }))

  const horizontalGap = facetColumns > 1 ? 0.08 : 0
  const verticalGap = facetRows > 1 ? 0.13 : 0
  const cellWidth = (1 - horizontalGap * (facetColumns - 1)) / facetColumns
  const cellHeight = (1 - verticalGap * (facetRows - 1)) / facetRows
  const axes: Record<string, unknown> = {}
  const annotations: unknown[] = []

  facets.forEach((facet, index) => {
    const number = index + 1
    const xStart = facet.column * (cellWidth + horizontalGap)
    const yTop = 1 - facet.row * (cellHeight + verticalGap)
    const xKey = number === 1 ? 'xaxis' : `xaxis${number}`
    const yKey = number === 1 ? 'yaxis' : `yaxis${number}`
    axes[xKey] = {
      domain: [xStart, xStart + cellWidth], anchor: number === 1 ? 'y' : `y${number}`,
      title: facet.row === facetRows - 1 ? `${xColumn.name}${xColumn.unit ? ` (${xColumn.unit})` : ''}` : '',
      gridcolor: spec.showGrid ? '#e5e9ed' : 'transparent', zeroline: false,
    }
    axes[yKey] = {
      domain: [yTop - cellHeight, yTop], anchor: number === 1 ? 'x' : `x${number}`,
      title: !groupYColumn && facet.column === 0 ? `${yColumn.name}${yColumn.unit ? ` (${yColumn.unit})` : ''}` : '',
      gridcolor: spec.showGrid ? '#e5e9ed' : 'transparent', zeroline: false,
    }
    if (wrapColumn && facet.label) annotations.push({
      text: `<b>${facet.label}</b>`, x: xStart + cellWidth / 2, y: yTop + 0.035,
      xref: 'paper', yref: 'paper', xanchor: 'center', yanchor: 'bottom',
      showarrow: false, font: { size: 10, color: '#53656e' },
    })
  })

  if (!wrapColumn && groupXColumn) {
    groupXValues.forEach((value, column) => {
      const xStart = column * (cellWidth + horizontalGap)
      annotations.push({
        text: `<b>${value}</b>`,
        x: xStart + cellWidth / 2, y: 1.035, xref: 'paper', yref: 'paper',
        xanchor: 'center', yanchor: 'bottom', showarrow: false, align: 'center',
        bgcolor: '#eef3f4', bordercolor: '#d7e0e3', borderpad: 4,
        font: { size: 11, color: '#40545e' },
      })
    })
  }

  if (!wrapColumn && groupYColumn) {
    groupYValues.forEach((value, row) => {
      const yTop = 1 - row * (cellHeight + verticalGap)
      annotations.push({
        text: `<b>${value}</b>`,
        x: -0.075, y: yTop - cellHeight / 2, xref: 'paper', yref: 'paper',
        xanchor: 'right', yanchor: 'middle', showarrow: false, align: 'right',
        bgcolor: '#eef3f4', bordercolor: '#d7e0e3', borderpad: 4,
        font: { size: 11, color: '#40545e' },
      })
    })
    annotations.push({
      text: `<b>${yColumn.name}${yColumn.unit ? ` (${yColumn.unit})` : ''}</b>`,
      x: -0.3, y: 0.5, xref: 'paper', yref: 'paper', xanchor: 'center', yanchor: 'middle',
      textangle: -90, showarrow: false, font: { size: 11, color: '#40545e' },
    })
  }

  return (
    <PlotlyChart
      data={data}
      layout={{
        ...axes,
        autosize: true,
        title: { text: `<b>${spec.title}</b><br><span style="font-size:12px;color:#68737d">${spec.subtitle}</span>`, x: 0.04, xanchor: 'left' },
        annotations,
        paper_bgcolor: '#ffffff', plot_bgcolor: '#fbfcfd',
        font: { family: 'Segoe UI, sans-serif', color: '#24313a', size: 12 },
        margin: { l: groupYColumn ? 148 : 66, r: 24, t: groupXColumn ? 126 : 100, b: 74 },
        legend: { orientation: 'h', x: 0, y: -0.2 }, hovermode: 'closest', bargap: 0.18,
      }}
      config={{ responsive: true, displaylogo: false, doubleClickDelay: 500, modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d'] }}
    />
  )
}
