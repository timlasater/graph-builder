import { useState } from 'react'
import { palettes } from '../appearance'
import { useBuilderStore } from '../store'
import { CollapsibleSection } from './CollapsibleSection'
import type { AxisAppearance, GraphSpec } from '../types'

const numeric = (value: string) => value === '' ? undefined : Number(value)
const symbols = ['circle', 'square', 'diamond', 'cross', 'triangle-up', 'triangle-down', 'star', 'hexagon']

export function AppearanceControls() {
  const { spec, dataset, updateSpec } = useBuilderStore()
  const [customColors, setCustomColors] = useState('')
  const [paletteError, setPaletteError] = useState('')
  const axis = (role: 'xAxis' | 'yAxis', patch: AxisAppearance) => updateSpec({ [role]: { ...spec[role], ...patch } })
  const set = <K extends keyof GraphSpec>(key: K, value: GraphSpec[K]) => updateSpec({ [key]: value })
  const categories = spec.x.length === 1 ? [...new Set(dataset.rows.map((row) => String(row.values[spec.x[0]])))].filter((value) => value !== 'null') : []
  const manualCategories = [...(spec.manualCategories ?? []).filter((value) => categories.includes(value)), ...categories.filter((value) => !spec.manualCategories?.includes(value))]
  return <>
    <CollapsibleSection title="Figure size and theme">
      <label>Theme<select value={spec.theme ?? 'light'} onChange={(event) => set('theme', event.target.value as GraphSpec['theme'])}><option value="light">Light</option><option value="paper">Print ready</option><option value="dark">Dark</option></select></label>
      <div className="property-grid"><label>Width (px)<input type="number" min="280" max="1400" value={spec.graphWidth ?? ''} placeholder="Fit workspace" onChange={(event) => set('graphWidth', numeric(event.target.value))} /></label><label>Height (px)<input type="number" min="260" max="1100" value={spec.graphHeight ?? ''} placeholder="Fit workspace" onChange={(event) => set('graphHeight', numeric(event.target.value))} /></label></div>
      <label>Aspect ratio (width ÷ height)<input type="number" min="0.25" max="5" step="0.01" value={spec.aspectRatio ?? ''} placeholder="Free" onChange={(event) => updateSpec({ aspectRatio: numeric(event.target.value), graphWidth: event.target.value ? spec.graphWidth ?? 700 : spec.graphWidth, graphHeight: undefined })} /></label>
      <div className="property-grid"><label>Font<select value={spec.fontFamily ?? 'Segoe UI, sans-serif'} onChange={(event) => set('fontFamily', event.target.value)}><option value="Segoe UI, sans-serif">Segoe UI</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option></select></label><label>Font size<input type="number" min="8" max="28" value={spec.fontSize ?? 12} onChange={(event) => set('fontSize', Number(event.target.value))} /></label></div>
    </CollapsibleSection>
    <CollapsibleSection title="Axes and categories">
      {(['xAxis', 'yAxis'] as const).map((role) => <div className="axis-controls" key={role}><strong>{role === 'xAxis' ? 'X axis' : 'Y axis'}</strong>
        <label>Axis title<input value={spec[role]?.title ?? ''} placeholder="Use column name and unit" onChange={(event) => axis(role, { title: event.target.value })} /></label>
        <div className="property-grid"><label>Scale<select value={spec[role]?.scale ?? 'linear'} onChange={(event) => axis(role, { scale: event.target.value as AxisAppearance['scale'] })}><option value="linear">Linear / date</option><option value="log">Logarithmic</option></select></label><label>Tick interval<input type="number" step="any" min="0" value={spec[role]?.tickInterval ?? ''} placeholder="Auto; days for dates" onChange={(event) => axis(role, { tickInterval: numeric(event.target.value) })} /></label></div>
        <div className="property-grid"><label>Minimum<input type="number" step="any" value={spec[role]?.min ?? ''} placeholder="Automatic" onChange={(event) => axis(role, { min: numeric(event.target.value) })} /></label><label>Maximum<input type="number" step="any" value={spec[role]?.max ?? ''} placeholder="Automatic" onChange={(event) => axis(role, { max: numeric(event.target.value) })} /></label></div>
        <label className="toggle-row"><span>Reverse direction</span><input type="checkbox" checked={spec[role]?.reversed ?? false} onChange={(event) => axis(role, { reversed: event.target.checked })} /></label>
        <label className="toggle-row"><span>Include zero</span><input type="checkbox" checked={spec[role]?.forceZero ?? false} onChange={(event) => axis(role, { forceZero: event.target.checked })} /></label>
      </div>)}
      <label>Category order<select value={spec.categoryOrder ?? 'data'} onChange={(event) => set('categoryOrder', event.target.value as GraphSpec['categoryOrder'])}><option value="data">Data order</option><option value="alphabetic">Alphabetic</option><option value="summary">Highest mean response first</option><option value="manual">Manual</option></select></label>
      {spec.categoryOrder === 'manual' && <div className="manual-categories">{manualCategories.map((category, index) => <div key={category}><span>{category}</span><button disabled={index === 0} onClick={() => { const order = [...manualCategories]; [order[index - 1], order[index]] = [order[index], order[index - 1]]; set('manualCategories', order) }} aria-label={`Move ${category} up`}>↑</button><button disabled={index === categories.length - 1} onClick={() => { const order = [...manualCategories]; [order[index], order[index + 1]] = [order[index + 1], order[index]]; set('manualCategories', order) }} aria-label={`Move ${category} down`}>↓</button></div>)}</div>}
    </CollapsibleSection>
    <CollapsibleSection title="Marks and colors">
      <label>Marker shape<select value={spec.markerShape ?? 'circle'} onChange={(event) => set('markerShape', event.target.value)}>{symbols.map((symbol) => <option value={symbol} key={symbol}>{symbol}</option>)}</select></label>
      <div className="property-grid"><label>Opacity<input type="number" min="0.05" max="1" step="0.05" value={spec.markerOpacity ?? 0.82} onChange={(event) => set('markerOpacity', Number(event.target.value))} /><small>1 = solid; lower values are more transparent.</small></label><label>Jitter (box points)<input type="number" min="0" max="1" step="0.05" value={spec.markerJitter ?? 0.28} onChange={(event) => set('markerJitter', Number(event.target.value))} /></label></div>
      <label>Line style<select value={spec.lineStyle ?? 'solid'} onChange={(event) => set('lineStyle', event.target.value as GraphSpec['lineStyle'])}><option value="solid">Solid</option><option value="dash">Dashed</option><option value="dot">Dotted</option><option value="dashdot">Dash dot</option></select></label>
      <div className="property-grid"><label>Bar gap (0–1)<input type="number" min="0" max="0.9" step="0.05" value={spec.barGap ?? 0.18} onChange={(event) => set('barGap', Number(event.target.value))} /></label><label>Bar width<input type="number" min="0.05" max="1" step="0.05" value={spec.barWidth ?? ''} placeholder="Automatic" onChange={(event) => set('barWidth', numeric(event.target.value))} /></label></div>
      <div className="property-grid"><label>Error cap (px)<input type="number" min="0" max="20" value={spec.errorCap ?? 4} onChange={(event) => set('errorCap', Number(event.target.value))} /></label><label>Error line (px)<input type="number" min="0.5" max="8" step="0.5" value={spec.errorThickness ?? 1.5} onChange={(event) => set('errorThickness', Number(event.target.value))} /></label></div>
      <label>Error bar color<select value={spec.errorColor ? 'custom' : 'series'} onChange={(event) => set('errorColor', event.target.value === 'series' ? undefined : '#0f6c75')}><option value="series">Match series</option><option value="custom">Custom</option></select></label>
      {spec.errorColor && <input type="color" aria-label="Custom error bar color" value={spec.errorColor} onChange={(event) => set('errorColor', event.target.value)} />}
      <label>Palette<select value={Object.entries(palettes).find(([, colors]) => JSON.stringify(colors) === JSON.stringify(spec.palette))?.[0] ?? (spec.palette ? 'custom' : 'standard')} onChange={(event) => { if (event.target.value !== 'custom') { set('palette', [...palettes[event.target.value as keyof typeof palettes]]); setPaletteError('') } }}><option value="standard">Standard</option><option value="colorblind">Colorblind accessible</option><option value="monochrome">Monochrome</option><option value="custom">Custom</option></select></label>
      <label>Custom colors (hex, comma separated)<input value={customColors} placeholder="#0f6c75, #ef8354" onChange={(event) => setCustomColors(event.target.value)} onBlur={() => { if (!customColors.trim()) return; const colors = customColors.split(',').map((value) => value.trim()); if (colors.every((value) => /^#[0-9a-fA-F]{6}$/.test(value))) { set('palette', colors); setPaletteError('') } else setPaletteError('Use six-digit hex colors, separated by commas (for example #0072b2, #e69f00).') }} /></label>
      {paletteError && <small className="setting-warning" role="alert">{paletteError}</small>}
      <label>Legend placement<select value={spec.legendPlacement ?? 'bottom'} onChange={(event) => set('legendPlacement', event.target.value as GraphSpec['legendPlacement'])}><option value="bottom">Below graph</option><option value="top">Above graph</option><option value="right">Right of graph</option><option value="hidden">Hide legend</option></select></label>
    </CollapsibleSection>
  </>
}
