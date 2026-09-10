import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

interface PlotlyChartProps {
  data: unknown[]
  layout: Record<string, unknown>
  config?: Record<string, unknown>
}

export function PlotlyChart({ data, layout, config }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    void Plotly.react(containerRef.current, data, layout, config)
  }, [config, data, layout])

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
