// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useBuilderStore } from '../store'
import { datasetFromMatrix } from '../importData'
import { GraphCanvas } from './GraphCanvas'

const chart = vi.hoisted(() => ({ props: undefined as { data: Record<string, unknown>[]; layout: Record<string, unknown>; onTitleDoubleClick: (target: { kind: 'graph' | 'subtitle' | 'xAxis' | 'yAxis' | 'annotation'; axisNumber?: number; annotationIndex?: number; text: string; rect: { left: number; top: number; width: number; height: number } }) => void } | undefined }))
vi.mock('./PlotlyChart', () => ({ PlotlyChart: (props: typeof chart.props) => { chart.props = props; return <div data-testid="plot" /> } }))

const original = useBuilderStore.getState()
afterEach(() => { cleanup(); vi.useRealTimers(); useBuilderStore.setState(original); chart.props = undefined })

describe('GraphCanvas panels', () => {
  it('splits assigned X and Y variables into a chosen number of columns', () => {
    useBuilderStore.setState({ spec: { ...original.spec, x: ['pressure', 'run'], y: ['dose', 'pressure'], xDisplay: 'subplots', yDisplay: 'subplots', subplotColumns: 1, color: undefined } })
    render(<GraphCanvas />)
    const traces = chart.props!.data
    expect(new Set(traces.map((trace) => trace.xaxis))).toEqual(new Set(['x', 'x2', 'x3', 'x4']))
    expect(traces.filter((trace) => trace.xaxis === 'x3').flatMap((trace) => trace.x as number[])).toEqual(original.dataset.rows.map((row) => row.values.pressure))
    expect(traces.filter((trace) => trace.xaxis === 'x3').flatMap((trace) => trace.y as number[])).toEqual(original.dataset.rows.map((row) => row.values.pressure))
    expect((chart.props!.layout.xaxis2 as { domain: number[] }).domain).toEqual([0, 1])
    expect((chart.props!.layout.yaxis4 as { domain: number[] }).domain[1]).toBeLessThan(0.3)
    expect((chart.props!.layout.yaxis3 as { title: { text: string } }).title.text).toBe('Test Pressure (psi)')
  })

  it('collates two Y measures into adjacent bars for each X category', () => {
    const dataset = datasetFromMatrix([['Device', 'Emitted Dose', 'Captured Dose'], ['A', 4, 3], ['B', 8, 6]], 'Devices')
    const [device, emitted, captured] = dataset.columns.map((column) => column.id)
    const layer = { id: 'bars', name: 'Bars', element: 'bar' as const }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [device], y: [emitted, captured], yDisplay: 'collate', color: undefined, layers: [layer], activeLayerId: layer.id } })
    render(<GraphCanvas />)
    const bars = chart.props!.data.filter((trace) => trace.type === 'bar')
    expect(bars).toHaveLength(2)
    expect(bars.map((trace) => trace.x)).toEqual([['A', 'B'], ['A', 'B']])
    expect(bars.map((trace) => trace.y)).toEqual([[4, 8], [3, 6]])
    expect(bars.map((trace) => trace.offsetgroup)).toEqual([emitted, captured])
    expect((bars[0].marker as { color: string }).color).not.toBe((bars[1].marker as { color: string }).color)
    expect(chart.props!.layout.barmode).toBe('group')
  })

  it('draws sample-SD and range error bars for mean bars only', () => {
    const dataset = datasetFromMatrix([['Group', 'Dose'], ['A', 2], ['A', 4], ['B', 9], ['B', 11]], 'Bar errors')
    const [group, dose] = dataset.columns.map((column) => column.id)
    const layer = { id: 'bars', name: 'Bars', element: 'bar' as const, barAggregation: 'mean' as const, errorBar: 'sd' as const }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [group], y: [dose], color: undefined, layers: [layer], activeLayerId: layer.id } })
    const view = render(<GraphCanvas />)
    let trace = chart.props!.data.find((item) => item.type === 'bar')!
    expect(trace.y).toEqual([3, 10])
    expect(trace.error_y).toMatchObject({ array: [Math.SQRT2, Math.SQRT2], arrayminus: [Math.SQRT2, Math.SQRT2] })
    view.unmount()
    useBuilderStore.setState({ spec: { ...useBuilderStore.getState().spec, layers: [{ ...layer, errorBar: 'range' }] } })
    render(<GraphCanvas />)
    trace = chart.props!.data.find((item) => item.type === 'bar')!
    expect(trace.error_y).toMatchObject({ array: [1, 1], arrayminus: [1, 1] })
    act(() => useBuilderStore.setState({ spec: { ...useBuilderStore.getState().spec, layers: [{ ...layer, barAggregation: 'count' }] } }))
    expect(chart.props!.data.find((item) => item.type === 'bar')?.error_y).toBeUndefined()
  })
  it('uses different X and Y variables and independent axes in custom panels', () => {
    useBuilderStore.setState({ spec: { ...original.spec, panels: [
      { id: 'first', title: 'Pressure and dose', x: 'pressure', y: 'dose' },
      { id: 'second', title: 'Run and pressure', x: 'run', y: 'pressure' },
    ] } })
    render(<GraphCanvas />)
    expect(screen.getByTestId('plot')).toBeTruthy()
    const traces = chart.props!.data
    expect(traces.filter((trace) => trace.xaxis === 'x').flatMap((trace) => trace.x as number[]).sort()).toEqual(original.dataset.rows.map((row) => row.values.pressure).sort())
    expect(traces.filter((trace) => trace.xaxis === 'x2').flatMap((trace) => trace.x as number[]).sort()).toEqual(original.dataset.rows.map((row) => row.values.run).sort())
    expect(traces.filter((trace) => trace.xaxis === 'x2').flatMap((trace) => trace.y as number[]).sort()).toEqual(original.dataset.rows.map((row) => row.values.pressure).sort())
    expect((chart.props!.layout.xaxis2 as Record<string, unknown>).matches).toBeUndefined()
    expect((chart.props!.layout.yaxis2 as Record<string, unknown>).matches).toBeUndefined()
    expect((chart.props!.layout.xaxis2 as Record<string, unknown>).title).toMatchObject({ text: 'Run' })
    expect((chart.props!.layout.yaxis2 as Record<string, unknown>).title).toMatchObject({ text: 'Test Pressure (psi)' })
    const titles = chart.props!.layout.annotations as { x: number; xref: string; text: string }[]
    expect(titles.filter((annotation) => annotation.text.includes('Pressure and dose'))).toMatchObject([{ x: 0.5, xref: 'x domain' }])
    expect(titles.filter((annotation) => annotation.text.includes('Run and pressure'))).toMatchObject([{ x: 0.5, xref: 'x2 domain' }])
  })

  it('uses custom axis titles in every subplot', () => {
    useBuilderStore.setState({ spec: { ...original.spec, xAxis: { title: 'Custom X' }, yAxis: { title: 'Custom Y' }, panels: [
      { id: 'first', title: 'First', x: 'pressure', y: 'dose' },
      { id: 'second', title: 'Second', x: 'run', y: 'pressure', xAxisTitle: 'Second X', yAxisTitle: 'Second Y' },
    ] } })
    render(<GraphCanvas />)
    expect((chart.props!.layout.xaxis as { title: { text: string } }).title.text).toBe('Custom X')
    expect((chart.props!.layout.yaxis as { title: { text: string } }).title.text).toBe('Custom Y')
    expect((chart.props!.layout.xaxis2 as { title: { text: string } }).title.text).toBe('Second X')
    expect((chart.props!.layout.yaxis2 as { title: { text: string } }).title.text).toBe('Second Y')
  })

  it('edits graph, subplot, and axis titles from the chart', () => {
    useBuilderStore.setState({ spec: { ...original.spec, panels: [{ id: 'first', title: 'First panel', x: 'pressure', y: 'dose' }] } })
    render(<GraphCanvas />)
    const rect = { left: 20, top: 20, width: 60, height: 20 }
    act(() => chart.props!.onTitleDoubleClick({ kind: 'graph', text: original.spec.title, rect }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit graph title' }), { target: { value: 'New figure' } })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Edit graph title' }))
    expect(useBuilderStore.getState().spec.title).toBe('New figure')
    act(() => chart.props!.onTitleDoubleClick({ kind: 'subtitle', text: original.spec.subtitle, rect }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit graph subtitle' }), { target: { value: 'Updated study' } })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Edit graph subtitle' }))
    expect(useBuilderStore.getState().spec.subtitle).toBe('Updated study')
    act(() => chart.props!.onTitleDoubleClick({ kind: 'annotation', annotationIndex: 0, text: 'First panel', rect }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit subplot title' }), { target: { value: 'Response panel' } })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Edit subplot title' }))
    expect(useBuilderStore.getState().spec.panels?.[0].title).toBe('Response panel')
    act(() => chart.props!.onTitleDoubleClick({ kind: 'xAxis', axisNumber: 1, text: 'Test Pressure (psi)', rect }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit X axis title' }), { target: { value: 'Pressure setting' } })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Edit X axis title' }))
    expect(useBuilderStore.getState().spec.panels?.[0].xAxisTitle).toBe('Pressure setting')
  })

  it('renders a box plot with only a Y variable', () => {
    useBuilderStore.setState({ spec: { ...original.spec, x: [], y: ['dose'], color: undefined, layers: [{ id: 'box', name: 'Box plot', element: 'box' }] } })
    render(<GraphCanvas />)
    expect(screen.getByTestId('plot')).toBeTruthy()
    expect(chart.props!.data[0].type).toBe('box')
    expect(new Set(chart.props!.data[0].x as string[])).toEqual(new Set(['All observations']))
    expect(chart.props!.data[0].y).toEqual(original.dataset.rows.map((row) => row.values.dose))
  })

  it('allows a Y-only box plot in one custom panel beside a different plot', () => {
    useBuilderStore.setState({ spec: { ...original.spec, layers: [
      { id: 'points', name: 'Points', element: 'points' },
      { id: 'box', name: 'Box plot', element: 'box' },
    ], panels: [
      { id: 'first', title: 'Scatter', x: 'pressure', y: 'dose' },
      { id: 'second', title: 'Dose distribution', y: 'dose' },
    ] } })
    render(<GraphCanvas />)
    expect(chart.props!.data.filter((trace) => trace.xaxis === 'x2').every((trace) => trace.type === 'box')).toBe(true)
    expect(new Set(chart.props!.data.filter((trace) => trace.xaxis === 'x2').flatMap((trace) => trace.x as string[]))).toEqual(new Set(['All observations']))
  })

  it('renames a legend entry on double-click without hiding it', () => {
    vi.useFakeTimers()
    render(<GraphCanvas />)
    const label = screen.getByRole('button', { name: 'Prototype A' })
    expect(screen.queryByRole('textbox', { name: 'Rename Prototype A' })).toBeNull()
    fireEvent.click(label, { detail: 1 })
    fireEvent.click(label, { detail: 2 })
    fireEvent.doubleClick(label)
    act(() => vi.advanceTimersByTime(400))
    expect(useBuilderStore.getState().spec.hiddenSeries).toBeUndefined()
    const editor = screen.getByRole('textbox', { name: 'Rename Prototype A' })
    fireEvent.change(editor, { target: { value: 'Control' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(useBuilderStore.getState().spec.seriesNames?.['layer-points::pressure::dose::Prototype A']).toBe('Control')
    expect(screen.getByRole('button', { name: 'Control' })).toBeTruthy()
  })

  it('still hides a legend entry on a single click', () => {
    vi.useFakeTimers()
    render(<GraphCanvas />)
    fireEvent.click(screen.getByRole('button', { name: 'Prototype A' }), { detail: 1 })
    act(() => vi.advanceTimersByTime(400))
    expect(useBuilderStore.getState().spec.hiddenSeries).toContain('layer-points::pressure::dose::Prototype A')
  })

  it('cancels a legend rename with Escape', () => {
    render(<GraphCanvas />)
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Prototype A' }))
    const editor = screen.getByRole('textbox', { name: 'Rename Prototype A' })
    fireEvent.change(editor, { target: { value: 'Temporary name' } })
    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(useBuilderStore.getState().spec.seriesNames).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Prototype A' })).toBeTruthy()
  })
})
