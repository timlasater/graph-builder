import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('bottom export legends clear angled category labels and the X title', async ({ page }, testInfo) => {
  await page.goto('/')
  const results = await page.evaluate(async () => {
    // Exercise the same renderer used by PNG, SVG, clipboard, and figure exports.
    const { renderFigureDataImage } = await import('/src/graphExport.ts')
    const categories = ['Competitor 1', 'Competitor 2', 'Us - Setting 1', 'Us - Setting 2', 'Us - Setting 3']
    const results = []
    for (const [width, height, compact] of [[1065, 647, false], [520, 400, true], [800, 950, false]] as const) {
      const url = await renderFigureDataImage({
        data: categories.map((name, index) => ({ type: 'box', name, x: [name, name, name], y: [index + 1, index + 2, index + 3], showlegend: true })),
        layout: { title: { text: 'Sinus Deposition' }, font: { size: 14 }, margin: { l: 65, r: 24, t: 80, b: 54 }, xaxis: { type: 'category', tickangle: -45, automargin: true, title: { text: 'Device', standoff: 12 } }, yaxis: { title: { text: 'Drug (mg)' } } },
        legendPlacement: 'bottom',
      }, 'svg', width, height, 1, compact)
      const png = width === 1065 ? await renderFigureDataImage({
        data: categories.map((name, index) => ({ type: 'box', name, x: [name, name, name], y: [index + 1, index + 2, index + 3], showlegend: true })),
        layout: { title: { text: 'Sinus Deposition' }, font: { size: 14 }, margin: { l: 65, r: 24, t: 80, b: 54 }, xaxis: { type: 'category', tickangle: -45, automargin: true, title: { text: 'Device', standoff: 12 } }, yaxis: { title: { text: 'Drug (mg)' } } },
        legendPlacement: 'bottom',
      }, 'png', width, height, 2) : undefined
      const host = document.createElement('div')
      host.innerHTML = decodeURIComponent(url.split(',')[1])
      document.body.append(host)
      const legend = host.querySelector('.legend')!.getBoundingClientRect()
      const title = host.querySelector('.xtitle')!.getBoundingClientRect()
      const svg = host.querySelector('svg')!.getBoundingClientRect()
      results.push({ gap: legend.top - title.bottom, fits: legend.bottom <= svg.bottom, width, png })
      host.remove()
    }
    return results
  })
  for (const result of results) {
    if (result.png) {
      const path = testInfo.outputPath('export-spacing.png')
      await writeFile(path, Buffer.from(result.png.split(',')[1], 'base64'))
      await testInfo.attach('PNG export spacing', { path, contentType: 'image/png' })
    }
    const measurements = JSON.stringify({ gap: result.gap, fits: result.fits, width: result.width })
    expect(result.gap, measurements).toBeGreaterThanOrEqual(10)
    expect(result.fits, measurements).toBe(true)
  }
})
