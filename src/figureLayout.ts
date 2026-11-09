import { renderFigureDataImage, type ImageFormat, type LegendPlacement } from './graphExport'
import type { FigureLayout } from './types'

type PlotElement = HTMLElement & { data?: unknown[]; layout?: Record<string, unknown> }
const svgNamespace = 'http://www.w3.org/2000/svg'

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('A graph image could not be added to the figure.'))
  image.src = url
})

const escapeXml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const embeddedSvg = async (url: string, index: number, x: number, y: number, width: number, height: number) => {
  const source = new DOMParser().parseFromString(await (await fetch(url)).text(), 'image/svg+xml')
  if (source.querySelector('parsererror') || source.documentElement.namespaceURI !== svgNamespace) throw new Error('A graph could not be rendered as SVG.')
  const root = source.documentElement
  const ids = new Map<string, string>()
  root.querySelectorAll('[id]').forEach((element) => {
    const id = element.getAttribute('id')!
    ids.set(id, `figure-${index}-${id}`)
    element.setAttribute('id', ids.get(id)!)
  })
  root.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      let value = attribute.value.replace(/url\(#([^)]+)\)/g, (match, id: string) => ids.has(id) ? `url(#${ids.get(id)})` : match)
      if (attribute.localName === 'href' && value.startsWith('#')) value = `#${ids.get(value.slice(1)) ?? value.slice(1)}`
      if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value)
    }
  })
  root.setAttribute('x', String(x)); root.setAttribute('y', String(y))
  root.setAttribute('width', String(width)); root.setAttribute('height', String(height))
  return new XMLSerializer().serializeToString(root)
}

/** Compose live graph previews as a scaled PNG or vector SVG page. */
export async function renderFigureLayout(layout: FigureLayout, previewRoot: HTMLElement, graphNames: string[], format: ImageFormat = 'png'): Promise<string> {
  const panels = Array.from(previewRoot.querySelectorAll<HTMLElement>('.figure-layout-panel'))
  if (!panels.length || panels.length !== graphNames.length) throw new Error('Choose at least one graph and wait for its preview before exporting.')
  const includeNames = layout.includeGraphNames !== false
  const top = layout.title.trim() ? 62 : 24; const gap = 20; const columns = Math.min(layout.columns, panels.length)
  const rows = Math.ceil(panels.length / columns)
  const panelWidth = Math.floor((layout.width - 48 - gap * (columns - 1)) / columns)
  const panelHeight = Math.floor((layout.height - top - 24 - gap * (rows - 1)) / rows)
  if (panelWidth < 220 || panelHeight < 280) throw new Error('Increase the page size or reduce the number of graphs so each plot has room for its axes.')
  const scale = format === 'png' ? layout.pngScale ?? 1 : 1
  if (format === 'png' && layout.width * layout.height * scale * scale > 40_000_000) throw new Error('Reduce the page size or PNG resolution before exporting.')
  const canvas = format === 'png' ? document.createElement('canvas') : undefined
  if (canvas) { canvas.width = layout.width * scale; canvas.height = layout.height * scale }
  const context = canvas?.getContext('2d')
  if (canvas && !context) throw new Error('This browser cannot create the figure image.')
  const svgParts = [`<svg xmlns="${svgNamespace}" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`, '<rect width="100%" height="100%" fill="#ffffff"/>']
  if (context) { context.scale(scale, scale); context.fillStyle = '#ffffff'; context.fillRect(0, 0, layout.width, layout.height) }
  if (layout.title.trim()) {
    if (context) { context.fillStyle = '#1c3038'; context.font = 'bold 25px Segoe UI, Arial, sans-serif'; context.fillText(layout.title.trim(), 24, 42, layout.width - 48) }
    else svgParts.push(`<text x="24" y="42" fill="#1c3038" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="700">${escapeXml(layout.title.trim())}</text>`)
  }
  for (let index = 0; index < panels.length; index++) {
    const plot = panels[index].querySelector<PlotElement>('.plotly-chart')
    if (!plot?.data || !plot.layout) throw new Error('A graph preview is still loading. Try exporting again in a moment.')
    const x = 24 + index % columns * (panelWidth + gap)
    const y = top + Math.floor(index / columns) * (panelHeight + gap)
    if (includeNames) {
      if (context) { context.fillStyle = '#294b52'; context.font = '600 15px Segoe UI, Arial, sans-serif'; context.fillText(graphNames[index], x + 4, y + 18, panelWidth - 8) }
      else svgParts.push(`<text class="figure-graph-name" x="${x + 4}" y="${y + 18}" fill="#294b52" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600">${escapeXml(graphNames[index])}</text>`)
    }
    const offset = includeNames ? 27 : 0
    const image = await renderFigureDataImage({ data: plot.data, layout: plot.layout, legendPlacement: (panels[index].dataset.legendPlacement as LegendPlacement) ?? 'bottom' }, format, panelWidth, panelHeight - offset, scale, true)
    if (context) context.drawImage(await loadImage(image), x, y + offset, panelWidth, panelHeight - offset)
    else svgParts.push(await embeddedSvg(image, index, x, y + offset, panelWidth, panelHeight - offset))
  }
  return context ? canvas!.toDataURL('image/png') : `data:image/svg+xml;charset=utf-8,${encodeURIComponent([...svgParts, '</svg>'].join(''))}`
}
