import Plotly from 'plotly.js-dist-min'

export type ImageFormat = 'png' | 'svg'
export type LegendPlacement = 'bottom' | 'top' | 'right' | 'hidden'
interface Figure { data: unknown[]; layout: Record<string, unknown>; legendPlacement: LegendPlacement }
let currentFigure: Figure | undefined

export const setExportFigure = (figure?: Figure) => { currentFigure = figure }
export const hasExportFigure = () => Boolean(currentFigure)

const exportLayout = (figure: Figure, width: number, height: number) => {
  const placement = figure.legendPlacement
  const originalMargin = figure.layout.margin as Record<string, number> | undefined
  return {
    ...figure.layout,
    width, height, autosize: false,
    showlegend: placement !== 'hidden',
    legend: placement === 'right' ? { orientation: 'v', x: 1.02, y: 1, xanchor: 'left', yanchor: 'top' } : placement === 'top' ? { orientation: 'h', x: 0, y: 1.12, xanchor: 'left', yanchor: 'bottom' } : { orientation: 'h', x: 0, y: -0.18, xanchor: 'left', yanchor: 'top' },
    margin: { ...originalMargin, b: placement === 'bottom' ? Math.max(originalMargin?.b ?? 54, 130) : originalMargin?.b ?? 54, r: placement === 'right' ? Math.max(originalMargin?.r ?? 24, 160) : originalMargin?.r ?? 24, t: placement === 'top' ? Math.max(originalMargin?.t ?? 100, 145) : originalMargin?.t ?? 100 },
  }
}

export const renderGraphImage = async (format: ImageFormat, width: number, height: number, scale = 1): Promise<string> => {
  if (!currentFigure) throw new Error('Build a graph before exporting it.')
  const figure = currentFigure
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  document.body.appendChild(container)
  try {
    await Plotly.newPlot(container, figure.data, exportLayout(figure, width, height), { staticPlot: true, displayModeBar: false })
    return await Plotly.toImage(container, { format, width, height, scale: format === 'svg' ? 1 : scale })
  } finally {
    Plotly.purge(container)
    container.remove()
  }
}

export const downloadText = (name: string, content: string, mime = 'application/json') => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadImage = (name: string, imageUrl: string) => {
  const link = document.createElement('a')
  link.href = imageUrl; link.download = name; link.click()
}

export const safeFileName = (name: string) => [...name.trim()].map((character) => character.charCodeAt(0) < 32 ? '-' : character).join('').replace(/[<>:"/\\|?*]+/g, '-').replace(/[. ]+$/g, '') || 'graph'

export const copyGraphPng = async (width: number, height: number, scale = 1) => {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('This browser cannot copy PNG images. Use Download PNG instead.')
  const blob = renderGraphImage('png', width, height, scale).then((image) => fetch(image)).then((response) => response.blob())
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined || Number.isNaN(value) ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
const quantile = (values: number[], p: number) => { const index = (values.length - 1) * p; const lower = Math.floor(index); const fraction = index - lower; return values[lower] + (values[Math.min(lower + 1, values.length - 1)] - values[lower]) * fraction }

export const plottedDataCsv = () => {
  if (!currentFigure) throw new Error('Build a graph before exporting its data.')
  const header = ['panel', 'series', 'element', 'x', 'y', 'n', 'minimum', 'q1', 'median', 'q3', 'maximum', 'error_lower', 'error_upper', 'source_rows']
  const lines = [header.join(',')]
  for (const trace of currentFigure.data as Record<string, unknown>[]) {
    const x = Array.isArray(trace.x) ? trace.x : []
    const y = Array.isArray(trace.y) ? trace.y : []
    const custom = Array.isArray(trace.customdata) ? trace.customdata : []
    const panel = String(trace.xaxis ?? 'x')
    const name = String(trace.name ?? '')
    const element = String(trace.type ?? '')
    if (element === 'box') {
      const groups = [...new Set(x.map(String))]
      for (const group of groups) {
        const indices = x.map((value, index) => String(value) === group ? index : -1).filter((index) => index >= 0)
        const values = indices.map((index) => Number(y[index])).filter(Number.isFinite).sort((a, b) => a - b)
        if (!values.length) continue
        const row = [panel, name, element, group, values.reduce((sum, value) => sum + value, 0) / values.length, values.length, values[0], quantile(values, .25), quantile(values, .5), quantile(values, .75), values.at(-1), '', '', indices.map((index) => custom[index]).filter(Boolean).join(';')]
        lines.push(row.map(csvCell).join(','))
      }
      continue
    }
    const error = trace.error_y as { array?: number[]; arrayminus?: number[] } | undefined
    for (let index = 0; index < Math.max(x.length, y.length); index += 1) {
      const meta = custom[index]
      const n = Array.isArray(meta) && typeof meta[0] === 'number' ? meta[0] : element === 'bar' && !custom.length ? y[index] : ''
      const sources = Array.isArray(meta) ? Array.isArray(meta[1]) ? meta[1].join(';') : '' : typeof meta === 'string' ? meta : ''
      const row = [panel, name, element, x[index], y[index], n, '', '', '', '', '', error?.arrayminus?.[index] ?? '', error?.array?.[index] ?? '', sources]
      lines.push(row.map(csvCell).join(','))
    }
  }
  return lines.join('\r\n') + '\r\n'
}
