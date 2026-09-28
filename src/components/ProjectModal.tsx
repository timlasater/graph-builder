import { useEffect, useRef, useState } from 'react'
import { copyGraphPng, downloadImage, downloadText, plottedDataCsv, renderGraphImage, safeFileName, type ImageFormat } from '../graphExport'
import { makeTemplate, parseTemplate, templateFitsDataset } from '../graphTemplates'
import { importTabularFile } from '../importData'
import { makeProject, parseProject, projectJson, rebuildLinkedDataset, type ProjectFile } from '../projects'
import { chooseSetupDataset } from '../sourceData'
import { projectGraphs, useBuilderStore } from '../store'

export function ProjectModal({ onClose, autosaveStatus }: { onClose: () => void; autosaveStatus: string }) {
  const state = useBuilderStore()
  const { dataset, spec, filters, projectName, activeGraphId, activeGraphName, openProject, openGraph, newGraph, duplicateGraph, renameGraph, renameProject, applyPlotSetup } = state
  const projectInput = useRef<HTMLInputElement>(null)
  const sourceInput = useRef<HTMLInputElement>(null)
  const templateInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(projectName)
  const [graphName, setGraphName] = useState(activeGraphName)
  const [templateName, setTemplateName] = useState(activeGraphName)
  const [mode, setMode] = useState<'embedded' | 'linked'>('embedded')
  const [pendingLinked, setPendingLinked] = useState<ProjectFile>()
  const [width, setWidth] = useState(spec.graphWidth ?? 1200)
  const [height, setHeight] = useState(spec.graphHeight ?? 800)
  const [scale, setScale] = useState(2)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pendingLinked) onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, pendingLinked])

  const report = (error: unknown) => setMessage(error instanceof Error ? error.message : 'This action could not be completed.')
  const saveFile = () => {
    try {
      const project = makeProject(name, dataset, projectGraphs(state), activeGraphId, mode)
      downloadText(`${safeFileName(project.name)}.graphbuilder.json`, projectJson(project))
      renameProject(project.name)
      setMessage(mode === 'embedded' ? 'Project downloaded with its data and graph settings.' : 'Linked project downloaded. Its source data must be reconnected when opened.')
    } catch (error) { report(error) }
  }
  const readProject = async (file?: File) => {
    if (!file) return
    setBusy(true); setMessage(undefined)
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('This project file is too large to open safely (100 MB limit).')
      const project = parseProject(await file.text())
      if (project.data.mode === 'linked') { setPendingLinked(project); setMessage(`Choose the source file “${project.data.source.fileName}” to finish opening this linked project.`) }
      else { openProject(project.name, project.data.dataset, project.graphs, project.activeGraphId); onClose() }
    } catch (error) { report(error) }
    finally { setBusy(false); if (projectInput.current) projectInput.current.value = '' }
  }
  const readLinkedSource = async (file?: File) => {
    if (!file || !pendingLinked || pendingLinked.data.mode !== 'linked') return
    setBusy(true); setMessage(undefined)
    try {
      const source = pendingLinked.data.source
      const sheets = await importTabularFile(file)
      const selected = chooseSetupDataset(sheets, { fileName: file.name, sheetName: source.sheetName }, source.signature)
      if (!selected) throw new Error('This source file does not have the columns expected by the linked project. The current project was not changed.')
      const restored = pendingLinked.data.columns ? rebuildLinkedDataset(selected, pendingLinked.data.columns) : selected
      openProject(pendingLinked.name, restored, pendingLinked.graphs, pendingLinked.activeGraphId)
      setPendingLinked(undefined); onClose()
    } catch (error) { report(error) }
    finally { setBusy(false); if (sourceInput.current) sourceInput.current.value = '' }
  }
  const exportTemplate = () => {
    try {
      const template = makeTemplate(templateName, dataset, spec, filters)
      downloadText(`${safeFileName(template.name)}.graphbuilder-template.json`, JSON.stringify(template, null, 2))
      setMessage('Template downloaded. It contains graph settings and filters, but no data rows.')
    } catch (error) { report(error) }
  }
  const importTemplate = async (file?: File) => {
    if (!file) return
    setBusy(true); setMessage(undefined)
    try {
      const template = parseTemplate(await file.text())
      if (!templateFitsDataset(template, dataset)) throw new Error('This template needs a dataset with matching column types. The current graph was not changed.')
      duplicateGraph()
      applyPlotSetup(template.spec, template.filters)
      renameGraph(template.name)
      setGraphName(template.name)
      setTemplateName(template.name)
      setMessage(`“${template.name}” opened as a new graph with the current data.`)
    } catch (error) { report(error) }
    finally { setBusy(false); if (templateInput.current) templateInput.current.value = '' }
  }
  const image = async (format: ImageFormat) => {
    setBusy(true); setMessage(undefined)
    try {
      const url = await renderGraphImage(format, width, height, scale)
      downloadImage(`${safeFileName(activeGraphName)}.${format}`, url)
      setMessage(`${format.toUpperCase()} downloaded at ${width} × ${height}${format === 'png' ? `, ${scale}× resolution` : ''}.`)
    } catch (error) { report(error) }
    finally { setBusy(false) }
  }
  const clipboard = async () => {
    setBusy(true); setMessage(undefined)
    try { await copyGraphPng(width, height, scale); setMessage('PNG copied to the clipboard.') }
    catch (error) { report(error) }
    finally { setBusy(false) }
  }
  const exportData = () => {
    try { downloadText(`${safeFileName(activeGraphName)}-plot-data.csv`, plottedDataCsv(), 'text/csv;charset=utf-8'); setMessage('Plotted data downloaded as CSV. Box plots include quartiles and mean.') }
    catch (error) { report(error) }
  }

  return <div className="modal-backdrop plot-setup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="plot-setup-dialog project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-title">
      <header><div><span className="eyebrow">PROJECTS & EXPORT</span><h2 id="project-title">Projects</h2><p>Keep several named graphs with one dataset. Download a project to take it with you, or reopen one later.</p></div><button className="dialog-close" aria-label="Close projects" onClick={onClose}>×</button></header>
      <div className="project-body">
        <section className="project-section"><h3>Project file</h3><label>Project name<input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="project-actions"><label>Data in saved file<select value={mode} onChange={(event) => setMode(event.target.value as 'embedded' | 'linked')}><option value="embedded">Embedded — include data</option><option value="linked">Linked — reconnect source</option></select></label><button disabled={busy} onClick={saveFile}>Download project</button><button disabled={busy} onClick={() => projectInput.current?.click()}>Open project…</button></div><small>Embedded projects preserve every data edit. Linked projects reopen the latest source and restore column settings and formulas, but not individual cell edits or excluded rows. All files stay on your computer. {autosaveStatus}</small></section>
        {pendingLinked && pendingLinked.data.mode === 'linked' && <section className="project-section project-reconnect"><h3>Reconnect linked data</h3><p>{pendingLinked.data.source.fileName}{pendingLinked.data.source.sheetName ? ` · ${pendingLinked.data.source.sheetName}` : ''}</p><div className="project-actions"><button disabled={busy} onClick={() => sourceInput.current?.click()}>Choose source file…</button><button onClick={() => { setPendingLinked(undefined); setMessage('Linked project opening cancelled. Your current project is unchanged.') }}>Cancel</button></div></section>}
        <section className="project-section"><h3>Graphs in this project</h3><div className="project-graph-list">{projectGraphs(state).map((graph) => <button key={graph.id} className={graph.id === activeGraphId ? 'active' : ''} disabled={graph.id === activeGraphId} onClick={() => { openGraph(graph.id); setGraphName(graph.name); setTemplateName(graph.name) }}>{graph.name}{graph.id === activeGraphId ? ' · open' : ''}</button>)}</div><div className="project-actions"><button onClick={() => { newGraph(); const next = useBuilderStore.getState().activeGraphName; setGraphName(next); setTemplateName(next) }}>New graph</button><button onClick={() => { duplicateGraph(); const next = useBuilderStore.getState().activeGraphName; setGraphName(next); setTemplateName(next) }}>Duplicate open graph</button></div><div className="project-actions"><label>Open graph name<input value={graphName} onChange={(event) => setGraphName(event.target.value)} /></label><button onClick={() => renameGraph(graphName)}>Rename</button></div></section>
        <section className="project-section"><h3>Reusable graph template</h3><p>Templates save the current graph and filters without data; import them with a dataset that has matching columns.</p><div className="project-actions"><label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} /></label><button onClick={exportTemplate}>Download template</button><button disabled={busy} onClick={() => templateInput.current?.click()}>Open template…</button></div></section>
        <section className="project-section"><h3>Export open graph</h3><div className="project-dimensions"><label>Width (px)<input type="number" min="320" max="6000" value={width} onChange={(event) => setWidth(Math.max(320, Math.min(6000, Number(event.target.value) || 320)))} /></label><label>Height (px)<input type="number" min="240" max="6000" value={height} onChange={(event) => setHeight(Math.max(240, Math.min(6000, Number(event.target.value) || 240)))} /></label><label>PNG resolution<select value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></label></div><div className="project-actions"><button disabled={busy} onClick={() => void image('png')}>Download PNG</button><button disabled={busy} onClick={() => void image('svg')}>Download SVG</button><button disabled={busy} onClick={() => void clipboard()}>Copy PNG</button><button disabled={busy} onClick={exportData}>Export plotted data CSV</button></div><small>SVG is vector artwork that stays sharp when resized. PNG uses the chosen resolution. The export includes a printable legend.</small></section>
      </div>
      {message && <p className="plot-setup-message" role="status">{message}</p>}
      <input ref={projectInput} className="visually-hidden" type="file" accept=".graphbuilder.json,.json" onChange={(event) => void readProject(event.target.files?.[0])} />
      <input ref={sourceInput} className="visually-hidden" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => void readLinkedSource(event.target.files?.[0])} />
      <input ref={templateInput} className="visually-hidden" type="file" accept=".graphbuilder-template.json,.json" onChange={(event) => void importTemplate(event.target.files?.[0])} />
    </section>
  </div>
}
