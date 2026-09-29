declare module 'plotly.js-cartesian-dist-min' {
  interface PlotlyApi {
    react(
      root: HTMLElement,
      data: unknown[],
      layout: Record<string, unknown>,
      config?: Record<string, unknown>,
    ): Promise<void>
    newPlot(root: HTMLElement, data: unknown[], layout: Record<string, unknown>, config?: Record<string, unknown>): Promise<void>
    toImage(root: HTMLElement, options: { format: 'png' | 'svg'; width: number; height: number; scale: number }): Promise<string>
    purge(root: HTMLElement): void
    Plots: {
      resize(root: HTMLElement): Promise<void>
    }
  }

  const Plotly: PlotlyApi
  export default Plotly
}
