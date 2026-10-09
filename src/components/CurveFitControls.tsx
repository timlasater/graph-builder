import { useState } from 'react'
import { nonlinearFit, type NonlinearModel } from '../nonlinearFit'
import { rowMatchesFilters } from '../store'
import type { Dataset, GraphLayer, GraphSpec, RowFilter } from '../types'

const fmt = (value: number) => Number(value.toPrecision(4)).toString()

export function CurveFitControls({ dataset, spec, filters, layer, updateLayer }: { dataset: Dataset; spec: GraphSpec; filters: RowFilter[]; layer: GraphLayer; updateLayer: (id: string, patch: Partial<GraphLayer>) => void }) {
  const [selectedSeries, setSelectedSeries] = useState('')
  const x = dataset.columns.find((column) => column.id === (layer.x ?? spec.x[0]))
  const y = dataset.columns.find((column) => column.id === (layer.y ?? spec.y[0]))
  const color = dataset.columns.find((column) => column.id === (layer.color ?? spec.color))
  const overlay = dataset.columns.find((column) => column.id === spec.overlay)
  const page = dataset.columns.find((column) => column.id === spec.page)
  const rows = dataset.rows.filter((row) => !row.excluded && rowMatchesFilters(row, filters) && (!page || spec.pageValue === undefined || row.values[page.id] === spec.pageValue))
  const keyFor = (row: typeof rows[number]) => [color && String(row.values[color.id]), overlay && String(row.values[overlay.id])].filter(Boolean).join(' · ') || 'All observations'
  const groups = [...new Set(rows.map(keyFor))]
  const group = groups.includes(selectedSeries) ? selectedSeries : groups[0]
  const fittedRows = rows.filter((row) => keyFor(row) === group)
  const model = layer.nonlinearModel ?? 'doseResponse'
  const outcome = x && y ? nonlinearFit(fittedRows.map((row) => row.values[x.id] === null ? Number.NaN : Number(row.values[x.id])), fittedRows.map((row) => row.values[y.id] === null ? Number.NaN : Number(row.values[y.id])), model) : { error: 'Assign numeric X and Y columns.' }
  const residuals = outcome.fit?.residuals ?? []
  const minX = Math.min(...residuals.map((point) => point.x)); const maxX = Math.max(...residuals.map((point) => point.x))
  const maxAbs = Math.max(1e-9, ...residuals.map((point) => Math.abs(point.residual)))
  return <>
    <label>Curve model<select value={model} onChange={(event) => updateLayer(layer.id, { nonlinearModel: event.target.value as NonlinearModel })}><option value="doseResponse">Dose–response (4 parameters)</option><option value="exponentialDecay">Exponential decay</option></select></label>
    {groups.length > 1 && <label>Fit results for series<select value={group} onChange={(event) => setSelectedSeries(event.target.value)}>{groups.map((item) => <option key={item}>{item}</option>)}</select></label>}
    {outcome.fit ? <div className="curve-fit-results" role="status"><strong>Fit results · n = {outcome.fit.n} · R² = {fmt(outcome.fit.rSquared)}</strong><small>Parameter · estimate · approximate 95% CI</small>{outcome.fit.parameters.map((parameter) => <span key={parameter.name}>{parameter.name}: {fmt(parameter.value)} · {parameter.lower === null ? 'CI unavailable' : `${fmt(parameter.lower)} to ${fmt(parameter.upper!)}`}</span>)}<strong>Residuals (observed minus fitted)</strong><svg viewBox="0 0 200 72" role="img" aria-label="Residuals by X value"><line x1="8" y1="36" x2="192" y2="36" stroke="#8ca7aa" strokeDasharray="3 3" />{residuals.map((point, index) => <circle key={index} cx={8 + (point.x - minX) / (maxX - minX || 1) * 184} cy={36 - point.residual / maxAbs * 30} r="2.5" fill="#0f6c75" />)}</svg></div> : <small className="setting-warning">{outcome.error}</small>}
    <small className="setting-help">Uses visible, included rows. Positive X values are required for dose–response. Confidence intervals are approximate; check the residuals for patterns before interpreting parameters.</small>
  </>
}
