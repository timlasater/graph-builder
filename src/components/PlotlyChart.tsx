import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import Plotly from 'plotly.js-dist-min'
import { setExportFigure, type LegendPlacement } from '../graphExport'

export type PlotTitleTarget = { kind: 'graph' | 'subtitle' | 'xAxis' | 'yAxis' | 'annotation'; axisNumber?: number; annotationIndex?: number; text: string; rect: { left: number; top: number; width: number; height: number } }
interface PlotlyChartProps {
  data: unknown[]
  layout: Record<string, unknown>
  config?: Record<string, unknown>
  onPointClick?: (customData: unknown, additive: boolean) => void
  onSelection?: (customData: unknown[]) => void
  onDeselect?: () => void
  legendPlacement?: LegendPlacement
  onTitleDoubleClick?: (target: PlotTitleTarget) => void
  suspendRender?: boolean
}

interface PlotlyEventPoint { customdata?: unknown }
interface PlotlyEvent { event?: MouseEvent; points?: PlotlyEventPoint[] }
type PlotlyElement = HTMLDivElement & { on: (name: string, handler: (event: PlotlyEvent) => void) => void; removeListener: (name: string, handler: (event: PlotlyEvent) => void) => void }

export function PlotlyChart({ data, layout, config, onPointClick, onSelection, onDeselect, onTitleDoubleClick, suspendRender = false, legendPlacement = 'bottom' }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const titleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.detail !== 2 || !onTitleDoubleClick || !(event.target instanceof Element) || !containerRef.current) return
    const element = event.target
    const title = element.closest('.gtitle, g[class^="g-x"][class$="title"], g[class^="g-y"][class$="title"], g.annotation')
    if (!title || !containerRef.current.contains(title)) return
    const axis = /^g-([xy])(\d*)title$/.exec(title.getAttribute('class') ?? '')
    const kind = title.classList.contains('gtitle') ? event.clientY > title.getBoundingClientRect().top + title.getBoundingClientRect().height / 2 ? 'subtitle' : 'graph' : axis?.[1] === 'x' ? 'xAxis' : axis?.[1] === 'y' ? 'yAxis' : 'annotation'
    const axisNumber = axis ? Number(axis[2] || 1) : undefined
    const annotationIndex = kind === 'annotation' ? Number(title.getAttribute('data-index')) : undefined
    const box = title.getBoundingClientRect()
    event.preventDefault(); event.stopPropagation()
    onTitleDoubleClick({ kind, axisNumber, annotationIndex, text: title.textContent ?? '', rect: { left: box.left, top: box.top, width: box.width, height: box.height } })
  }

  useEffect(() => {
    setExportFigure({ data, layout, legendPlacement })
    return () => setExportFigure(undefined)
  }, [data, layout, legendPlacement])

  useEffect(() => {
    const container = containerRef.current as PlotlyElement | null
    if (!container || suspendRender) return
    const clicked = (event: PlotlyEvent) => { const point = event.points?.[0]; if (point) onPointClick?.(point.customdata, Boolean(event.event?.ctrlKey || event.event?.metaKey || event.event?.shiftKey)) }
    const selected = (event: PlotlyEvent) => onSelection?.((event.points ?? []).map((point) => point.customdata))
    const deselected = () => onDeselect?.()
    let active = true
    void Plotly.react(container, data, layout, config).then(() => {
      if (!active) return
      container.on('plotly_click', clicked)
      container.on('plotly_selected', selected)
      container.on('plotly_deselect', deselected)
    })
    return () => {
      active = false
      if (typeof container.removeListener === 'function') {
        container.removeListener('plotly_click', clicked)
        container.removeListener('plotly_selected', selected)
        container.removeListener('plotly_deselect', deselected)
      }
    }
  }, [config, data, layout, onDeselect, onPointClick, onSelection, suspendRender])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      void Plotly.Plots.resize(container)
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      Plotly.purge(container)
    }
  }, [])

  return <div ref={containerRef} className="plotly-chart" onClickCapture={titleDoubleClick} />
}
