import { renderFigureDataImage, type LegendPlacement } from './graphExport'
import type { FigureLayout } from './types'

type PlotElement = HTMLElement & { data?: unknown[]; layout?: Record<string, unknown> }

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('A graph image could not be added to the figure.'))
  image.src = url
})

/** Render live graph previews at print resolution and compose one PNG page. */
export async function renderFigureLayout(layout: FigureLayout, previewRoot: HTMLElement, graphNames: string[]): Promise<string> {
  const panels = Array.from(previewRoot.querySelectorAll<HTMLElement>('.figure-layout-panel'))
  if (!panels.length || panels.length !== graphNames.length) throw new Error('Choose at least one graph and wait for its preview before exporting.')
  const canvas = document.createElement('canvas')
  canvas.width = layout.width; canvas.height = layout.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot create the figure image.')
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#1c3038'; context.font = 'bold 25px Segoe UI, Arial, sans-serif'
  if (layout.title.trim()) context.fillText(layout.title.trim(), 24, 42, layout.width - 48)
  const top = layout.title.trim() ? 62 : 24; const gap = 20; const columns = Math.min(layout.columns, panels.length)
  const rows = Math.ceil(panels.length / columns)
  const panelWidth = Math.floor((layout.width - 48 - gap * (columns - 1)) / columns)
  const panelHeight = Math.floor((layout.height - top - 24 - gap * (rows - 1)) / rows)
  if (panelWidth < 220 || panelHeight < 280) throw new Error('Increase the page size or reduce the number of graphs so each plot has room for its axes.')
  for (let index = 0; index < panels.length; index++) {
    const plot = panels[index].querySelector<PlotElement>('.plotly-chart')
    if (!plot?.data || !plot.layout) throw new Error('A graph preview is still loading. Try exporting again in a moment.')
    const x = 24 + index % columns * (panelWidth + gap)
    const y = top + Math.floor(index / columns) * (panelHeight + gap)
    context.fillStyle = '#294b52'; context.font = '600 15px Segoe UI, Arial, sans-serif'
    context.fillText(graphNames[index], x + 4, y + 18, panelWidth - 8)
    const url = await renderFigureDataImage({ data: plot.data, layout: plot.layout, legendPlacement: (panels[index].dataset.legendPlacement as LegendPlacement) ?? 'bottom' }, 'png', panelWidth, panelHeight - 27, 1, true)
    context.drawImage(await loadImage(url), x, y + 27, panelWidth, panelHeight - 27)
  }
  return canvas.toDataURL('image/png')
}
