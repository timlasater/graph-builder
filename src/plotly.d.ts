declare module 'plotly.js-dist-min' {
  interface PlotlyApi {
    react(
      root: HTMLElement,
      data: unknown[],
      layout: Record<string, unknown>,
      config?: Record<string, unknown>,
    ): Promise<void>
    purge(root: HTMLElement): void
    Plots: {
      resize(root: HTMLElement): Promise<void>
    }
  }

  const Plotly: PlotlyApi
  export default Plotly
}
