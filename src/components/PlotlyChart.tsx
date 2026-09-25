import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

interface PlotlyChartProps {
  data: unknown[]
  layout: Record<string, unknown>
  config?: Record<string, unknown>
  onPointClick?: (customData: unknown, additive: boolean) => void
  onSelection?: (customData: unknown[]) => void
  onDeselect?: () => void
}

interface PlotlyEventPoint { customdata?: unknown }
interface PlotlyEvent { event?: MouseEvent; points?: PlotlyEventPoint[] }
type PlotlyElement = HTMLDivElement & { on: (name: string, handler: (event: PlotlyEvent) => void) => void; removeListener: (name: string, handler: (event: PlotlyEvent) => void) => void }

export function PlotlyChart({ data, layout, config, onPointClick, onSelection, onDeselect }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current as PlotlyElement | null
    if (!container) return
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
  }, [config, data, layout, onDeselect, onPointClick, onSelection])

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

  return <div ref={containerRef} className="plotly-chart" />
}
