// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { plottedDataCsv, renderGraphImage, setExportFigure } from './graphExport'

const plotly = vi.hoisted(() => ({ newPlot: vi.fn(async () => {}), toImage: vi.fn(async () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), purge: vi.fn() }))
vi.mock('plotly.js-dist-min', () => ({ default: plotly }))

afterEach(() => { setExportFigure(undefined); plotly.newPlot.mockClear(); plotly.toImage.mockClear(); plotly.purge.mockClear() })

describe('graph export', () => {
  it('exports a printable SVG with the legend and requested dimensions', async () => {
    setExportFigure({ data: [{ type: 'scatter', x: [1], y: [2], name: 'Dose', showlegend: true }], layout: { showlegend: false, margin: { b: 54 } }, legendPlacement: 'bottom' })
    const url = await renderGraphImage('svg', 1000, 700, 3)
    expect(url).toContain('image/svg+xml')
    expect(plotly.newPlot).toHaveBeenCalledWith(expect.any(HTMLElement), expect.any(Array), expect.objectContaining({ showlegend: true, width: 1000, height: 700 }), expect.any(Object))
    expect(plotly.toImage).toHaveBeenCalledWith(expect.any(HTMLElement), { format: 'svg', width: 1000, height: 700, scale: 1 })
    expect(plotly.purge).toHaveBeenCalledOnce()
  })

  it('exports plotted values and box quartiles as CSV', () => {
    setExportFigure({ data: [
      { type: 'scatter', name: 'Dose', xaxis: 'x', x: [1], y: [42], customdata: ['row-1'] },
      { type: 'box', name: 'Distribution', xaxis: 'x2', x: ['A', 'A', 'A', 'A', 'A'], y: [1, 2, 3, 4, 5], customdata: ['a', 'b', 'c', 'd', 'e'] },
    ], layout: {}, legendPlacement: 'hidden' })
    const csv = plottedDataCsv()
    expect(csv).toContain('x,Dose,scatter,1,42')
    expect(csv).toContain('x2,Distribution,box,A,3,5,1,2,3,4,5')
  })
})
