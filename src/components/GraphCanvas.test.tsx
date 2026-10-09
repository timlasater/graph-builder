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
  it('links a two-group comparison result to the visible graph', () => {
    const dataset = datasetFromMatrix([['Group', 'Value'], ['A', 1], ['A', 2], ['A', 3], ['B', 4], ['B', 5], ['B', 6]], 'Comparison')
    const [x, y] = dataset.columns
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [x.id], y: [y.id], color: undefined, comparison: { method: 'welch', categoryA: 'A', categoryB: 'B', confidenceLevel: 0.95 } } })
    render(<GraphCanvas />)
    const annotations = chart.props!.layout.annotations as { text: string }[]
    expect(annotations.some((annotation) => annotation.text.includes('B − A: 3') && annotation.text.includes('95% CI'))).toBe(true)
  })

  it('draws a nonlinear dose–response curve from positive X values', () => {
    const dataset = datasetFromMatrix([['Dose', 'Response'], [0.25, 2.12], [0.5, 2.38], [1, 2.89], [2, 4.2], [4, 6.06], [8, 8.06], [16, 9.14], [32, 9.72]], 'Curve')
    const [x, y] = dataset.columns
    const layer = { id: 'curve', name: 'Curve fit', element: 'nonlinear' as const, nonlinearModel: 'doseResponse' as const, showEquation: true, showSampleSize: true, showRSquared: true }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [x.id], y: [y.id], color: undefined, layers: [layer], activeLayerId: layer.id } })
    render(<GraphCanvas />)
    expect(chart.props!.data[0].mode).toBe('lines')
    expect((chart.props!.data[0].x as number[]).length).toBe(150)
    expect((chart.props!.data[0].y as number[])[0]).toBeLessThan((chart.props!.data[0].y as number[]).at(-1)!)
    const annotations = chart.props!.layout.annotations as { text: string }[]
    expect(annotations.some((annotation) => annotation.text.includes('ŷ =') && annotation.text.includes('R² =') && annotation.text.includes('n = 8'))).toBe(true)
  })

  it('draws one connected trace per subject and preserves source-row selection IDs', () => {
    const dataset = datasetFromMatrix([
      ['Subject', 'Visit', 'Value', 'Group'],
      ['A', 'Before', 2, 'Drug'], ['B', 'Before', 3, 'Drug'], ['A', 'After', 5, 'Drug'], ['B', 'After', 6, 'Drug'],
    ], 'Paired')
    const [id, x, y, group] = dataset.columns
    x.modelingType = 'nominal'
    const layer = { id: 'paired', name: 'Paired plot', element: 'paired' as const, pairId: id.id }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [x.id], y: [y.id], color: group.id, layers: [layer], activeLayerId: layer.id } })
    render(<GraphCanvas />)
    const traces = chart.props!.data
    expect(traces).toHaveLength(2)
    expect(traces.map((trace) => trace.mode)).toEqual(['lines+markers', 'lines+markers'])
    expect(traces.map((trace) => trace.y)).toEqual([[2, 5], [3, 6]])
    expect(traces.map((trace) => trace.customdata)).toEqual([[dataset.rows[0].id, dataset.rows[2].id], [dataset.rows[1].id, dataset.rows[3].id]])
    expect(traces.map((trace) => trace.showlegend)).toEqual([true, false])
  })

  it('colors two Y variables differently, including with a Color grouping', () => {
    const dataset = datasetFromMatrix([['X', 'Left', 'Right', 'Group'], [1, 10, 1000, 'A'], [2, 20, 2000, 'B'], [3, 30, 3000, 'A']], 'Dual colors')
    const [x, left, right, group] = dataset.columns.map((column) => column.id)
    const layer = { id: 'points', name: 'Points', element: 'points' as const }
    const baseSpec = { ...original.spec, x: [x], y: [left, right], yDisplay: 'dual' as const, color: undefined, layers: [layer], activeLayerId: layer.id }
    useBuilderStore.setState({ dataset, spec: baseSpec })
    const view = render(<GraphCanvas />)
    expect(chart.props!.data.map((trace) => trace.yaxis)).toEqual(['y', 'y2'])
    expect((chart.props!.data[0].marker as { color: string }).color).not.toBe((chart.props!.data[1].marker as { color: string }).color)
    view.unmount()
    useBuilderStore.setState({ spec: { ...baseSpec, color: group } })
    render(<GraphCanvas />)
    const colors = chart.props!.data.map((trace) => (trace.marker as { color: string }).color)
    expect(colors).toHaveLength(4)
    expect(new Set(colors).size).toBe(4)
  })

  it('splits assigned X and Y variables into a chosen number of columns', () => {
    useBuilderStore.setState({ spec: { ...original.spec, x: ['pressure', 'run'], y: ['dose', 'pressure'], xDisplay: 'subplots', yDisplay: 'subplots', subplotColumns: 1, color: undefined } })
    render(<GraphCanvas />)
    const traces = chart.props!.data
    expect(new Set(traces.map((trace) => trace.xaxis))).toEqual(new Set(['x', 'x2', 'x3', 'x4']))
    expect(traces.filter((trace) => trace.xaxis === 'x3').flatMap((trace) => trace.x as number[])).toEqual(original.dataset.rows.map((row) => row.values.pressure))
    expect(traces.filter((trace) => trace.xaxis === 'x3').flatMap((trace) => trace.y as number[])).toEqual(original.dataset.rows.map((row) => row.values.pressure))
    expect((chart.props!.layout.xaxis2 as { domain: number[] }).domain).toEqual([0, 1])
    expect((chart.props!.layout.yaxis4 as { domain: number[] }).domain[1]).toBeLessThan(0.3)
    expect((chart.props!.layout.yaxis3 as { title: { text: string } }).title.text).toBe('Input Setting')
  })

  it('collates two Y measures into adjacent bars for each X category', () => {
    const dataset = datasetFromMatrix([['Device', 'Emitted Dose', 'Captured Dose'], ['A', 4, 3], ['B', 8, 6]], 'Devices')
    const [device, emitted, captured] = dataset.columns.map((column) => column.id)
    const layer = { id: 'bars', name: 'Bars', element: 'bar' as const }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [device], y: [emitted, captured], yDisplay: 'collate', color: undefined, layers: [layer], activeLayerId: layer.id } })
    render(<GraphCanvas />)
    const bars = chart.props!.data.filter((trace) => trace.type === 'bar')
    expect(bars).toHaveLength(2)
    expect(bars.map((trace) => trace.x)).toEqual([[-0.19, 0.81], [0.19, 1.19]])
    expect(bars.map((trace) => trace.y)).toEqual([[4, 8], [3, 6]])
    expect(chart.props!.layout.xaxis).toMatchObject({ type: 'linear', tickvals: [0, 1], ticktext: ['A', 'B'] })
    expect((bars[0].marker as { color: string }).color).not.toBe((bars[1].marker as { color: string }).color)
    expect(chart.props!.layout.barmode).toBe('group')
  })

  it.each(['points', 'box'] as const)('collates %s by device and measure', (element) => {
    const dataset = datasetFromMatrix([['Device', 'Emitted Dose', 'Captured Dose'], ['A', 4, 3], ['A', 5, 4], ['B', 8, 6]], 'Devices')
    const [device, emitted, captured] = dataset.columns.map((column) => column.id)
    const layer = { id: element, name: element, element }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [device], y: [emitted, captured], yDisplay: 'collate', color: undefined, layers: [layer], activeLayerId: layer.id } })
    render(<GraphCanvas />)
    const traces = chart.props!.data
    expect(traces).toHaveLength(2)
    expect(traces.map((trace) => trace.x)).toEqual([[-0.19, -0.19, 0.81], [0.19, 0.19, 1.19]])
    expect(traces.map((trace) => trace.y)).toEqual([[4, 5, 8], [3, 4, 6]])
    expect(traces.map((trace) => trace.type)).toEqual(element === 'box' ? ['box', 'box'] : ['scatter', 'scatter'])
    expect(chart.props!.layout.xaxis).toMatchObject({ type: 'linear', tickvals: [0, 1], ticktext: ['A', 'B'] })
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
  it('plots supplied means and errors without fabricating replicate points', () => {
    const dataset = datasetFromMatrix([['Group', 'Mean', 'SD', 'N'], ['A', 12, 2, 3], ['B', 20, null, 8]], 'Supplied')
    const [group, mean, sd, n] = dataset.columns.map((column) => column.id)
    const layer = { id: 'supplied', name: 'Mean line', element: 'summary' as const, summaryInput: 'precomputed' as const, precomputedErrorColumn: sd, precomputedNColumn: n, errorBar: 'sd' as const, showObservations: true }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [group], y: [mean], color: undefined, layers: [layer], activeLayerId: layer.id } })
    render(<GraphCanvas />)
    expect(chart.props!.data).toHaveLength(1)
    expect(chart.props!.data[0].y).toEqual([12, 20])
    expect(chart.props!.data[0].error_y).toMatchObject({ array: [2, null] })
    expect(screen.getByRole('status').textContent).toContain('Missing or invalid uncertainty for B')
  })

  it('plots percentages of the visible summary total', () => {
    const dataset = datasetFromMatrix([['Group', 'Dose'], ['A', 2], ['A', 4], ['B', 9]], 'Percent')
    const [group, dose] = dataset.columns.map((column) => column.id)
    const layer = { id: 'percent', name: 'Bars', element: 'bar' as const, valueTransform: 'percentTotal' as const }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [group], y: [dose], color: undefined, layers: [layer], activeLayerId: layer.id } })
    render(<GraphCanvas />)
    expect(chart.props!.data[0].y).toEqual([25, 75])
  })

  it('shows regression sample size and a configurable smoothed trend', () => {
    const dataset = datasetFromMatrix([['X', 'Y'], [1, 1], [2, 3], [3, 9], [4, 16]], 'Trend')
    const [x, y] = dataset.columns.map((column) => column.id)
    const fit = { id: 'fit', name: 'Fit', element: 'fit' as const, showSampleSize: true }
    const smooth = { id: 'smooth', name: 'Smooth trend', element: 'smooth' as const, smoothWindow: 3 }
    useBuilderStore.setState({ dataset, spec: { ...original.spec, x: [x], y: [y], color: undefined, layers: [fit, smooth], activeLayerId: fit.id } })
    render(<GraphCanvas />)
    expect((chart.props!.layout.annotations as { text: string }[]).some((annotation) => annotation.text.includes('n = 4'))).toBe(true)
    expect(chart.props!.data.find((trace) => String(trace.name).includes('Smooth trend'))?.y).toEqual([2, 13 / 3, 28 / 3, 12.5])
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
    expect((chart.props!.layout.xaxis2 as Record<string, unknown>).title).toMatchObject({ text: 'Trial' })
    expect((chart.props!.layout.yaxis2 as Record<string, unknown>).title).toMatchObject({ text: 'Input Setting' })
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
    act(() => chart.props!.onTitleDoubleClick({ kind: 'xAxis', axisNumber: 1, text: 'Input Setting', rect }))
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
    const label = screen.getByRole('button', { name: 'Group A' })
    expect(screen.queryByRole('textbox', { name: 'Rename Group A' })).toBeNull()
    fireEvent.click(label, { detail: 1 })
    fireEvent.click(label, { detail: 2 })
    fireEvent.doubleClick(label)
    act(() => vi.advanceTimersByTime(400))
    expect(useBuilderStore.getState().spec.hiddenSeries).toBeUndefined()
    const editor = screen.getByRole('textbox', { name: 'Rename Group A' })
    fireEvent.change(editor, { target: { value: 'Control' } })
    fireEvent.keyDown(editor, { key: 'Enter' })
    expect(useBuilderStore.getState().spec.seriesNames?.['layer-points::pressure::dose::Group A']).toBe('Control')
    expect(screen.getByRole('button', { name: 'Control' })).toBeTruthy()
  })

  it('still hides a legend entry on a single click', () => {
    vi.useFakeTimers()
    render(<GraphCanvas />)
    fireEvent.click(screen.getByRole('button', { name: 'Group A' }), { detail: 1 })
    act(() => vi.advanceTimersByTime(400))
    expect(useBuilderStore.getState().spec.hiddenSeries).toContain('layer-points::pressure::dose::Group A')
  })

  it('cancels a legend rename with Escape', () => {
    render(<GraphCanvas />)
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Group A' }))
    const editor = screen.getByRole('textbox', { name: 'Rename Group A' })
    fireEvent.change(editor, { target: { value: 'Temporary name' } })
    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(useBuilderStore.getState().spec.seriesNames).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Group A' })).toBeTruthy()
  })
})
