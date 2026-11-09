import { compareCategories } from '../comparisons'
import { rowMatchesFilters } from '../store'
import type { Dataset, GraphComparison, GraphSpec, RowFilter } from '../types'

const fmt = (value: number) => Number(value.toPrecision(4)).toString()
const pLabel = (value: number) => value < 0.0001 ? '< 0.0001' : fmt(value)

export function ComparisonControls({ dataset, spec, filters, updateSpec }: { dataset: Dataset; spec: GraphSpec; filters: RowFilter[]; updateSpec: (patch: Partial<GraphSpec>) => void }) {
  const x = dataset.columns.find((column) => column.id === spec.x[0])
  const y = dataset.columns.find((column) => column.id === spec.y[0])
  const page = dataset.columns.find((column) => column.id === spec.page)
  const rows = dataset.rows.filter((row) => !row.excluded && rowMatchesFilters(row, filters) && (!page || spec.pageValue === undefined || row.values[page.id] === spec.pageValue))
  const categories = x ? [...new Set(rows.map((row) => row.values[x.id]).filter((value) => value !== null).map((value) => String(x.valueLabels?.[String(value)] ?? value)))] : []
  const comparison = spec.comparison
  const patch = (changes: Partial<GraphComparison>) => comparison && updateSpec({ comparison: { ...comparison, ...changes } })
  const output = comparison && x && y ? compareCategories(rows, x, y, comparison, dataset.columns.find((column) => column.id === comparison.pairId)) : undefined
  return <>
    {!comparison ? <button className="add-comparison-button" disabled={!x || !y || categories.length < 2} onClick={() => updateSpec({ comparison: { method: 'welch', categoryA: categories[0], categoryB: categories[1], confidenceLevel: 0.95 } })}>Add comparison</button> : <>
      <label>Test<select value={comparison.method} onChange={(event) => patch({ method: event.target.value as GraphComparison['method'] })}><option value="welch">Independent (Welch t test)</option><option value="paired">Paired t test</option></select></label>
      <div className="property-grid"><label>Category A<select value={comparison.categoryA} onChange={(event) => patch({ categoryA: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Category B<select value={comparison.categoryB} onChange={(event) => patch({ categoryB: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
      {comparison.method === 'paired' && <label>Subject ID<select value={comparison.pairId ?? ''} onChange={(event) => patch({ pairId: event.target.value || undefined })}><option value="">Choose a column</option>{dataset.columns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}</select></label>}
      <label>Confidence level<select value={comparison.confidenceLevel} onChange={(event) => patch({ confidenceLevel: Number(event.target.value) })}><option value="0.9">90%</option><option value="0.95">95%</option><option value="0.99">99%</option></select></label>
      {output?.result ? <div className="comparison-result" role="status"><strong>{comparison.categoryB} − {comparison.categoryA}: {fmt(output.result.difference)}</strong><span>{Math.round(comparison.confidenceLevel * 100)}% CI: {fmt(output.result.lower)} to {fmt(output.result.upper)}</span><span>p {pLabel(output.result.pValue)} · n = {output.result.nA} / {output.result.nB}</span>{output.result.notes.map((note) => <small key={note}>{note}</small>)}</div> : <small className="setting-warning">{output?.error}</small>}
      <button onClick={() => updateSpec({ comparison: undefined })}>Remove comparison</button>
    </>}
    <small className="setting-help">Uses visible, included rows. Difference is B minus A. A p value estimates how surprising this difference would be if the true difference were zero.</small>
  </>
}
