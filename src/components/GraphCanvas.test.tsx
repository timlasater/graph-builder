// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useBuilderStore } from '../store'
import { GraphCanvas } from './GraphCanvas'

const chart = vi.hoisted(() => ({ props: undefined as { data: Record<string, unknown>[]; layout: Record<string, unknown> } | undefined }))
vi.mock('./PlotlyChart', () => ({ PlotlyChart: (props: typeof chart.props) => { chart.props = props; return <div data-testid="plot" /> } }))

const original = useBuilderStore.getState()
afterEach(() => { cleanup(); useBuilderStore.setState(original); chart.props = undefined })

describe('GraphCanvas panels', () => {
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
    expect((chart.props!.layout.xaxis2 as Record<string, unknown>).title).toBe('Run')
    expect((chart.props!.layout.yaxis2 as Record<string, unknown>).title).toBe('Test Pressure (psi)')
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
})
