import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import Plotly from 'plotly.js-cartesian-dist-min'
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
  registerExport?: boolean
}

interface PlotlyEventPoint {
  customdata?: unknown
  x?: string | number
  hoverOnBox?: boolean
  curveNumber?: number
  pointNumber?: number
  xaxis?: { d2c: (value: string | number) => number }
  data?: { type?: string; x?: (string | number)[]; y?: number[]; customdata?: unknown[] }
}
interface PlotlyEvent { event?: MouseEvent; points?: PlotlyEventPoint[] }
function boxMeasurements(point: PlotlyEventPoint) {
  const { data, x } = point
  if (data?.type !== 'box' || x === undefined) return []
  return (data.x ?? []).flatMap((position, index) => {
    const value = data.y?.[index]
    return String(position) === String(x) && value !== undefined && Number.isFinite(value)
      ? [{ value, row: data.customdata?.[index] }]
      : []
  })
}

type PlotlyElement = HTMLDivElement & { on: (name: string, handler: (event: PlotlyEvent) => void) => void; removeListener: (name: string, handler: (event: PlotlyEvent) => void) => void }

export function PlotlyChart({ data, layout, config, onPointClick, onSelection, onDeselect, onTitleDoubleClick, suspendRender = false, registerExport = true, legendPlacement = 'bottom' }: PlotlyChartProps) {
  const [measurementCount, setMeasurementCount] = useState<number>()
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
    if (!registerExport) return
    setExportFigure({ data, layout, legendPlacement })
    return () => setExportFigure(undefined)
  }, [data, layout, legendPlacement, registerExport])

  useEffect(() => {
    const container = containerRef.current as PlotlyElement | null
    if (!container || suspendRender) return
    const clicked = ({ event, points }: PlotlyEvent) => {
      const point = points?.[0]
      if (!point) return
      const additive = Boolean(event?.ctrlKey || event?.metaKey || event?.shiftKey)
      if (!point.hoverOnBox) {
        onPointClick?.(point.customdata ?? (point.pointNumber === undefined ? undefined : point.data?.customdata?.[point.pointNumber]), additive)
        return
      }
      if (!event || point.x === undefined) return
      const measurements = boxMeasurements(point).sort((a, b) => a.value - b.value)
      if (!measurements.length) return
      // Read the drawn lines so hit testing follows Plotly's layout and median clamping.
      type BoxPath = SVGPathElement & { __data__?: { pos: number; q1: number; med: number; q3: number } }
      const path = [...container.querySelectorAll<BoxPath>('.boxlayer path.box')].find((box) => {
        const group = box.parentElement as (Element & { __data__?: { trace?: { index: number } }[] }) | null
        return group?.__data__?.[0]?.trace?.index === point.curveNumber
          && box.__data__?.pos === point.xaxis?.d2c(point.x!)
      })
      const summary = path?.__data__
      const matrix = path?.getScreenCTM()
      const coordinates = path?.getAttribute('d')?.match(/^M([^,]+),([^H]+)H([^M]+)M([^,]+),([^H]+)H[^V]+V([^H]+)/)
      if (!summary || !matrix || !coordinates) return
      const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
      const [, , median, right, left, q1, q3] = coordinates
      const lines = [Number(median), Number(q1), Number(q3)]
      const top = Math.min(lines[1], lines[2])
      const bottom = Math.max(lines[1], lines[2])
      if (x < Number(left) - 2 || x > Number(right) + 2 || y < top - 2 || y > bottom + 2) return
      const nearest = lines.reduce((best, line, index) => Math.abs(line - y) < Math.abs(lines[best] - y) ? index : best, 0)
      const tolerance = Math.min(3, Math.max(0.75, (bottom - top) / 8))
      if (Math.abs(lines[nearest] - y) > tolerance) {
        onPointClick?.(measurements.map(({ row }) => row), additive)
        return
      }
      const statistic = [summary.med, summary.q1, summary.q3][nearest]
      const upperIndex = measurements.findIndex(({ value }) => value >= statistic)
      const upper = measurements[upperIndex] ?? measurements.at(-1)!
      const lower = measurements[upperIndex - 1]
      onPointClick?.(upper.value === statistic || !lower ? upper.row : [lower.row, upper.row], additive)
    }
    const selected = (event: PlotlyEvent) => onSelection?.((event.points ?? []).map((point) => point.customdata))
    const deselected = () => onDeselect?.()
    const unhovered = () => setMeasurementCount(undefined)
    const hovered = (event: PlotlyEvent) => {
      const point = event.points?.[0]
      const count = point ? boxMeasurements(point).length : 0
      setMeasurementCount(count || undefined)
    }
    unhovered()
    let active = true
    void Plotly.react(container, data, layout, config).then(() => {
      if (!active) return
      container.on('plotly_hover', hovered)
      container.on('plotly_unhover', unhovered)
      container.on('plotly_click', clicked)
      container.on('plotly_selected', selected)
      container.on('plotly_deselect', deselected)
    })
    return () => {
      active = false
      if (typeof container.removeListener === 'function') {
        container.removeListener('plotly_hover', hovered)
        container.removeListener('plotly_unhover', unhovered)
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

  return <div className="plotly-chart-wrap"><div ref={containerRef} className="plotly-chart" onClickCapture={titleDoubleClick} />{measurementCount !== undefined && <div className="measurement-count-hover" role="status">Measurements (n): {measurementCount}</div>}</div>
}
