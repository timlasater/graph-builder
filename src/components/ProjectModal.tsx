import { useEffect, useRef, useState } from 'react'
import { copyGraphPng, downloadImage, downloadText, plottedDataCsv, renderGraphImage, safeFileName, type ImageFormat } from '../graphExport'
import { chooseDesktopFile, clearRecentProjects, isDesktop, readDesktopFile, readDesktopProject, recentProjects, rememberProject, sameDesktopPath, saveDesktopImage, saveDesktopText } from '../desktopFiles'
import { makeTemplate, parseTemplate, templateFitsDataset } from '../graphTemplates'
import { readLegacyTemplates } from '../legacySetups'
import { importTabularFile } from '../importData'
import { datasetSignature } from '../datasetSignature'
import { makeProject, parseProject, projectJson, rebuildLinkedDataset, type ProjectFile } from '../projects'
import { saveCurrentDesktopProject } from '../projectSave'
import { renderFigureLayout } from '../figureLayout'
import { chooseSourceDataset } from '../sourceData'
import { DesktopUpdater } from './DesktopUpdater'
import { GraphCanvas } from './GraphCanvas'
import { hasUnsavedProjectChanges, projectFingerprint, projectGraphs, useBuilderStore } from '../store'
import { useDialogFocus } from '../useDialogFocus'
import type { Dataset, FigureLayout } from '../types'

interface PendingOpen { project: ProjectFile; dataset: Dataset; nativePath?: string }

export function ProjectModal({ onClose, autosaveStatus, initialProjectPath, initialProjectFile, initialSavePrompt = false }: { onClose: () => void; autosaveStatus: string; initialProjectPath?: string; initialProjectFile?: File; initialSavePrompt?: boolean }) {
  const state = useBuilderStore()
  const { dataset, spec, filters, projectName, activeGraphId, activeGraphName, openProject, openGraph, newGraph, duplicateGraph, deleteGraph, renameGraph, renameProject, applyGraphTemplate } = state
  const projectInput = useRef<HTMLInputElement>(null)
  const sourceInput = useRef<HTMLInputElement>(null)
  const templateInput = useRef<HTMLInputElement>(null)
  const layoutPreviewRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(projectName)
  const [graphName, setGraphName] = useState(activeGraphName)
  const [templateName, setTemplateName] = useState(activeGraphName)
  const [mode, setMode] = useState<'embedded' | 'linked'>(state.projectMode)
  const [showSaveChoice, setShowSaveChoice] = useState(initialSavePrompt)
  const [saveChoiceError, setSaveChoiceError] = useState<string>()
  const [pendingLinked, setPendingLinked] = useState<ProjectFile>()
  const [pendingLinkedPath, setPendingLinkedPath] = useState<string>()
  const [pendingDeleteId, setPendingDeleteId] = useState<string>()
  const [width, setWidth] = useState(spec.graphWidth ?? 1200)
  const [height, setHeight] = useState(spec.graphHeight ?? 800)
  const [scale, setScale] = useState(2)
  const [showLayout, setShowLayout] = useState(false)
  const [busy, setBusy] = useState(false)
  const [updateInstalling, setUpdateInstalling] = useState(false)
  const [message, setMessage] = useState<string>()
  const [openError, setOpenError] = useState<string>()
  const [pendingOpen, setPendingOpen] = useState<PendingOpen>()
  const [saveError, setSaveError] = useState<string>()
  const dialogRef = useDialogFocus<HTMLElement>(!pendingOpen && !openError && !showSaveChoice)
  const decisionRef = useDialogFocus<HTMLElement>(Boolean(pendingOpen || openError))
  const saveChoiceRef = useDialogFocus<HTMLElement>(showSaveChoice)
  const [legacyTemplates] = useState(() => readLegacyTemplates())
  const [recent, setRecent] = useState(() => isDesktop() ? recentProjects() : [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || updateInstalling || busy) return
      if (pendingOpen || openError) { setPendingOpen(undefined); setOpenError(undefined); setSaveError(undefined); if (initialProjectPath || initialProjectFile) onClose() }
      else if (showSaveChoice) { setShowSaveChoice(false); setSaveChoiceError(undefined) }
      else if (!pendingLinked) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, pendingLinked, pendingOpen, openError, showSaveChoice, initialProjectPath, initialProjectFile, updateInstalling, busy])

  const report = (error: unknown) => setMessage(error instanceof Error ? error.message : 'This action could not be completed.')
  const reportOpenError = (error: unknown) => {
    setPendingOpen(undefined)
    setOpenError(error instanceof Error ? error.message : 'The project could not be opened. Your current project was not changed.')
  }
  const cancelOpen = () => {
    setPendingOpen(undefined); setOpenError(undefined); setSaveError(undefined)
    if (initialProjectPath || initialProjectFile) onClose()
  }
  const completeOpen = ({ project, dataset: nextDataset, nativePath }: PendingOpen) => {
    openProject(project.name, nextDataset, project.graphs, project.activeGraphId, nativePath, project.data.mode, project.figureLayout)
    if (nativePath) rememberProject(nativePath, project.name)
    setPendingOpen(undefined); setPendingLinked(undefined)
    onClose()
  }
  const prepareOpen = (next: PendingOpen) => {
    if (hasUnsavedProjectChanges(useBuilderStore.getState())) setPendingOpen(next)
    else completeOpen(next)
  }
  const saveAndOpen = async () => {
    if (!pendingOpen) return
    setBusy(true); setSaveError(undefined)
    try {
      const current = useBuilderStore.getState()
      const backup = makeProject(current.projectName, current.dataset, projectGraphs(current), current.activeGraphId, 'embedded', current.figureLayout)
      if (isDesktop()) {
        const path = await saveCurrentDesktopProject(false, pendingOpen.nativePath)
        if (!path) { setSaveError('Saving was canceled. Your current project is still open.'); return }
        if (pendingOpen.nativePath && sameDesktopPath(path, pendingOpen.nativePath)) {
          setPendingOpen(undefined); setPendingLinked(undefined); onClose()
          return
        }
      } else downloadText(`${safeFileName(backup.name)}.graphbuilder`, projectJson(backup))
      completeOpen(pendingOpen)
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'The current project could not be saved. It remains open.') }
    finally { setBusy(false) }
  }
  const graphs = projectGraphs(state)
  const figureLayout: FigureLayout = state.figureLayout ?? { title: 'Figure layout', graphIds: [activeGraphId], columns: 2, width: 1200, height: 900 }
  const selectedLayoutGraphs = figureLayout.graphIds.map((id) => graphs.find((graph) => graph.id === id)).filter((graph): graph is (typeof graphs)[number] => Boolean(graph))
  const changeLayout = (patch: Partial<FigureLayout>) => state.setFigureLayout({ ...figureLayout, ...patch })
  const exportLayout = async () => {
    if (!layoutPreviewRef.current || !selectedLayoutGraphs.length) return
    setBusy(true); setMessage(undefined)
    try {
      if (!state.figureLayout) state.setFigureLayout(figureLayout)
      const image = await renderFigureLayout(figureLayout, layoutPreviewRef.current, selectedLayoutGraphs.map((graph) => graph.name))
      if (isDesktop()) { if (!await saveDesktopImage(`${safeFileName(figureLayout.title)}.png`, image, 'png')) return }
      else downloadImage(`${safeFileName(figureLayout.title)}.png`, image)
      setMessage(`Figure page ${isDesktop() ? 'saved' : 'downloaded'} at ${figureLayout.width} × ${figureLayout.height}.`)
    } catch (error) { report(error) }
    finally { setBusy(false) }
  }
  const pendingDelete = graphs.find((graph) => graph.id === pendingDeleteId)
  const confirmDelete = () => {
    if (!pendingDeleteId || graphs.length <= 1) return
    deleteGraph(pendingDeleteId)
    const next = useBuilderStore.getState().activeGraphName
    setGraphName(next); setTemplateName(next); setPendingDeleteId(undefined)
    setMessage('Graph deleted. You can use Undo to restore it until the project is closed.')
  }
  const saveFile = async () => {
    setBusy(true); setMessage(undefined); setSaveChoiceError(undefined)
    try {
      if (isDesktop() && mode === 'linked' && dataset.source?.fileName && !dataset.source.nativePath) {
        const sourcePath = await chooseDesktopFile('source')
        if (!sourcePath) return
        const source = dataset.source
        const sourceName = sourcePath.split(/[\\/]/).at(-1) || source.fileName
        const sheets = await importTabularFile(await readDesktopFile(sourcePath), source.skipRows ?? 0)
        const expectedSignature = source.signature ?? datasetSignature({ columns: dataset.columns.filter((column) => !column.formula) })
        const selected = chooseSourceDataset(sheets, { fileName: sourceName, sheetName: source.sheetName, nativePath: sourcePath, skipRows: source.skipRows }, expectedSignature)
        if (!selected?.source) throw new Error('That source file does not have the expected columns. Choose the original data file before saving a linked project.')
        useBuilderStore.getState().setDatasetSource(selected.source)
      }
      const current = useBuilderStore.getState()
      const project = makeProject(name, current.dataset, projectGraphs(current), current.activeGraphId, mode, current.figureLayout)
      const fingerprint = projectFingerprint({ ...current, projectName: project.name, projectMode: mode })
      if (isDesktop()) {
        const path = await saveDesktopText(`${safeFileName(project.name)}.graphbuilder`, projectJson(project), 'graphbuilder')
        if (!path) return
        rememberProject(path, project.name); setRecent(recentProjects())
        useBuilderStore.getState().setProjectPath(path)
      } else downloadText(`${safeFileName(project.name)}.graphbuilder`, projectJson(project))
      renameProject(project.name)
      useBuilderStore.getState().setProjectMode(mode)
      useBuilderStore.getState().markProjectSaved(fingerprint)
      setMessage(isDesktop() ? 'Project saved on this computer.' : mode === 'embedded' ? 'Project downloaded with its data and graph settings.' : 'Linked project downloaded. Its source data must be reconnected when opened.')
      setShowSaveChoice(false)
    } catch (error) { if (showSaveChoice) setSaveChoiceError(error instanceof Error ? error.message : 'The project could not be saved.'); else report(error) }
    finally { setBusy(false) }
  }
  const saveBeforeUpdate = async () => {
    try {
      const current = useBuilderStore.getState()
      const project = makeProject(current.projectName, current.dataset, projectGraphs(current), current.activeGraphId, 'embedded', current.figureLayout)
      const path = await saveDesktopText(`${safeFileName(project.name)}.graphbuilder`, projectJson(project), 'graphbuilder')
      if (!path) return false
      rememberProject(path, project.name)
      setRecent(recentProjects())
      setMessage('An embedded copy of your project was saved before updating.')
      return true
    } catch (error) { report(error); return false }
  }
  const readProject = async (file?: File, nativePath?: string) => {
    if (!file && !nativePath) return
    setBusy(true); setMessage(undefined); setOpenError(undefined); setPendingLinked(undefined); setPendingLinkedPath(undefined)
    try {
      if (file && file.size > 100 * 1024 * 1024) throw new Error('This project file is too large to open safely (100 MB limit).')
      const project = parseProject(nativePath ? await readDesktopProject(nativePath) : await file!.text())
      if (project.data.mode === 'linked') {
        const source = project.data.source
        if (isDesktop() && source.nativePath) {
          try {
            const sheets = await importTabularFile(await readDesktopFile(source.nativePath), source.skipRows ?? 0)
            const selected = chooseSourceDataset(sheets, source, source.signature)
            if (!selected) throw new Error('The saved source path no longer has matching columns.')
            const restored = project.data.columns ? rebuildLinkedDataset(selected, project.data.columns) : selected
            prepareOpen({ project, dataset: restored, nativePath })
            return
          } catch { /* A moved or inaccessible source can still be selected manually. */ }
        }
        setPendingLinked(project); setPendingLinkedPath(nativePath); setMessage(`Choose the source file “${source.fileName}” to finish opening this linked project.`)
      } else prepareOpen({ project, dataset: project.data.dataset, nativePath })
    } catch (error) { reportOpenError(error) }
    finally { setBusy(false); if (projectInput.current) projectInput.current.value = '' }
  }
  const readAssociatedProject = useRef(readProject)
  const openedAssociatedPath = useRef<string | undefined>(undefined)
  useEffect(() => { readAssociatedProject.current = readProject })
  useEffect(() => {
    if (!initialProjectPath) return
    let active = true
    queueMicrotask(() => {
      if (active && openedAssociatedPath.current !== initialProjectPath) {
        openedAssociatedPath.current = initialProjectPath
        void readAssociatedProject.current(undefined, initialProjectPath)
      }
    })
    return () => { active = false }
  }, [initialProjectPath])
  const openedDropFile = useRef<File | undefined>(undefined)
  useEffect(() => {
    if (!initialProjectFile || openedDropFile.current === initialProjectFile) return
    openedDropFile.current = initialProjectFile
    void readAssociatedProject.current(initialProjectFile)
  }, [initialProjectFile])
  const readLinkedSource = async (file?: File, nativePath?: string) => {
    if (!file || !pendingLinked || pendingLinked.data.mode !== 'linked') return
    setBusy(true); setMessage(undefined)
    try {
      const source = pendingLinked.data.source
      const sheets = await importTabularFile(file, source.skipRows ?? 0)
      const selected = chooseSourceDataset(sheets, { fileName: file.name, sheetName: source.sheetName, nativePath, skipRows: source.skipRows }, source.signature)
      if (!selected) throw new Error('This source file does not have the columns expected by the linked project. The current project was not changed.')
      const restored = pendingLinked.data.columns ? rebuildLinkedDataset(selected, pendingLinked.data.columns) : selected
      prepareOpen({ project: pendingLinked, dataset: restored, nativePath: pendingLinkedPath })
    } catch (error) { reportOpenError(error) }
    finally { setBusy(false); if (sourceInput.current) sourceInput.current.value = '' }
  }
  const chooseProject = async () => {
    if (!isDesktop()) { projectInput.current?.click(); return }
    try { const path = await chooseDesktopFile('project'); if (path) await readProject(undefined, path) }
    catch (error) { report(error) }
  }
  const chooseLinkedSource = async () => {
    if (!isDesktop()) { sourceInput.current?.click(); return }
    try { const path = await chooseDesktopFile('source', pendingLinked?.data.mode === 'linked' ? pendingLinked.data.source.nativePath : undefined); if (path) await readLinkedSource(await readDesktopFile(path), path) }
    catch (error) { report(error) }
  }
  const chooseTemplate = async () => {
    if (!isDesktop()) { templateInput.current?.click(); return }
    try { const path = await chooseDesktopFile('template'); if (path) await importTemplate(await readDesktopFile(path)) }
    catch (error) { report(error) }
  }
  const exportTemplate = async () => {
    try {
      const template = makeTemplate(templateName, dataset, spec, filters)
      const filename = `${safeFileName(template.name)}.graphbuilder-template.json`
      if (isDesktop()) { if (!await saveDesktopText(filename, JSON.stringify(template, null, 2), 'graphbuilder-template.json')) return }
      else downloadText(filename, JSON.stringify(template, null, 2))
      setMessage(`Template ${isDesktop() ? 'saved' : 'downloaded'}. It contains graph settings and filters, but no data rows.`)
    } catch (error) { report(error) }
  }
  const importTemplate = async (file?: File) => {
    if (!file) return
    setBusy(true); setMessage(undefined)
    try {
      const template = parseTemplate(await file.text())
      if (!templateFitsDataset(template, dataset)) throw new Error('This template needs a dataset with matching column types. The current graph was not changed.')
      duplicateGraph()
      applyGraphTemplate(template.spec, template.filters)
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
      if (isDesktop()) { if (!await saveDesktopImage(`${safeFileName(activeGraphName)}.${format}`, url, format)) return }
      else downloadImage(`${safeFileName(activeGraphName)}.${format}`, url)
      setMessage(`${format.toUpperCase()} ${isDesktop() ? 'saved' : 'downloaded'} at ${width} × ${height}${format === 'png' ? `, ${scale}× resolution` : ''}.`)
    } catch (error) { report(error) }
    finally { setBusy(false) }
  }
  const clipboard = async () => {
    setBusy(true); setMessage(undefined)
    try { await copyGraphPng(width, height, scale); setMessage('PNG copied to the clipboard.') }
    catch (error) { report(error) }
    finally { setBusy(false) }
  }
  const exportData = async () => {
    try {
      const filename = `${safeFileName(activeGraphName)}-plot-data.csv`
      const content = plottedDataCsv()
      if (isDesktop()) { if (!await saveDesktopText(filename, content, 'csv')) return }
      else downloadText(filename, content, 'text/csv;charset=utf-8')
      setMessage(`Plotted data ${isDesktop() ? 'saved' : 'downloaded'} as CSV. Box plots include quartiles and mean.`)
    }
    catch (error) { report(error) }
  }

  const beginSave = () => { if (isDesktop()) { setSaveChoiceError(undefined); setShowSaveChoice(true) } else void saveFile() }

  return <><div className="modal-backdrop project-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updateInstalling && !pendingOpen && !openError && !showSaveChoice) onClose() }}>
    <section ref={dialogRef} className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-title" aria-hidden={Boolean(pendingOpen || openError || showSaveChoice)} inert={Boolean(pendingOpen || openError || showSaveChoice)} tabIndex={-1}>
      <header><div><span className="eyebrow">PROJECTS & EXPORT</span><h2 id="project-title">Projects</h2><p>Keep several named graphs with one dataset. Download a project to take it with you, or reopen one later.</p></div><button className="dialog-close" aria-label="Close projects" disabled={updateInstalling || Boolean(pendingOpen || openError)} onClick={onClose}>×</button></header>
      <div className="project-body">
        <section className="project-section"><h3>Project file</h3><span className="project-save-state">Current project: <strong>{state.projectMode === 'embedded' ? 'Embedded — includes data' : 'Linked — reconnects source'}</strong></span><label>Project name<input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && !busy) { event.preventDefault(); beginSave() } }} /></label><div className="project-actions"><label>Data in saved file<select value={mode} onChange={(event) => setMode(event.target.value as 'embedded' | 'linked')}><option value="embedded">Embedded — include data</option><option value="linked">Linked — reconnect source</option></select></label><button disabled={busy} onClick={beginSave}>{isDesktop() ? 'Save project…' : 'Download project'}</button><button disabled={busy} onClick={() => void chooseProject()}>Open project…</button></div>{mode === 'linked' && dataset.source?.fileName && <span className="project-save-state">Source location: <strong>{dataset.source.nativePath ?? `${dataset.source.fileName} (${isDesktop() ? 'choose its location when saving' : 'folder path unavailable in the browser'})`}</strong></span>}<small>Embedded projects preserve every data edit. Linked projects reopen the latest source and restore column settings and formulas, but not individual cell edits or excluded rows. All files stay on your computer. {autosaveStatus}</small></section>
        {isDesktop() && <DesktopUpdater saveBeforeInstall={saveBeforeUpdate} onInstalling={setUpdateInstalling} />}
        {recent.length > 0 && <section className="project-section"><div className="project-section-heading"><h3>Recent projects</h3><button className="clear-recent-button" disabled={busy} onClick={() => { clearRecentProjects(); setRecent([]); setMessage('Recent projects cleared. Your project files were not deleted.') }}>Clear recent projects</button></div><div className="project-graph-list">{recent.map((item) => <button key={item.path} title={item.path} disabled={busy} onClick={() => void readProject(undefined, item.path)}>{item.name}</button>)}</div></section>}
        {pendingLinked && pendingLinked.data.mode === 'linked' && <section className="project-section project-reconnect"><h3>Reconnect linked data</h3><p>{pendingLinked.data.source.fileName}{pendingLinked.data.source.sheetName ? ` · ${pendingLinked.data.source.sheetName}` : ''}</p><p className="source-last-path">Last found at {pendingLinked.data.source.nativePath ?? pendingLinked.data.source.fileName}{!pendingLinked.data.source.nativePath && <span> {isDesktop() ? '(folder path was not saved with this project)' : '(folder path unavailable in the browser)'}</span>}</p><div className="project-actions"><button disabled={busy} onClick={() => void chooseLinkedSource()}>Choose source file…</button><button onClick={() => { setPendingLinked(undefined); setPendingLinkedPath(undefined); setMessage('Linked project opening cancelled. Your current project is unchanged.'); if (initialProjectPath || initialProjectFile) onClose() }}>Cancel</button></div></section>}
        <section className="project-section"><h3>Graphs in this project</h3><div className="project-graph-list">{graphs.map((graph) => <div className="project-graph-item" key={graph.id}><button className={graph.id === activeGraphId ? 'active' : ''} disabled={graph.id === activeGraphId} onClick={() => { openGraph(graph.id); setGraphName(graph.name); setTemplateName(graph.name); setPendingDeleteId(undefined) }}>{graph.name}{graph.id === activeGraphId ? ' · open' : ''}</button><button className="project-delete-button" disabled={graphs.length === 1} aria-label={`Delete ${graph.name}`} title={graphs.length === 1 ? 'A project must have at least one graph' : `Delete ${graph.name}`} onClick={() => setPendingDeleteId(graph.id)}>Delete</button></div>)}</div>{pendingDelete && <div className="project-delete-confirm" role="group" aria-label="Confirm graph deletion"><span>Delete “{pendingDelete.name}” from this project?</span><button onClick={confirmDelete}>Delete graph</button><button onClick={() => setPendingDeleteId(undefined)}>Cancel</button></div>}<div className="project-actions"><button onClick={() => { newGraph(); const next = useBuilderStore.getState().activeGraphName; setGraphName(next); setTemplateName(next) }}>New graph</button><button onClick={() => { duplicateGraph(); const next = useBuilderStore.getState().activeGraphName; setGraphName(next); setTemplateName(next) }}>Duplicate open graph</button></div><div className="project-actions"><label>Open graph name<input value={graphName} onChange={(event) => setGraphName(event.target.value)} /></label><button onClick={() => renameGraph(graphName)}>Rename</button></div></section>
        <section className="project-section"><div className="project-section-heading"><h3>Figure layout</h3><button onClick={() => setShowLayout((open) => !open)}>{showLayout ? 'Hide layout' : 'Open layout'}</button></div>{showLayout && <><p>Arrange up to four saved graphs on one page. The arrangement stays in the project file.</p><label>Page title<input value={figureLayout.title} onChange={(event) => changeLayout({ title: event.target.value })} /></label><div className="project-dimensions"><label>Columns<select value={figureLayout.columns} onChange={(event) => changeLayout({ columns: Number(event.target.value) as 1 | 2 })}><option value="1">One</option><option value="2">Two</option></select></label><label>Width (px)<input type="number" min="320" max="6000" value={figureLayout.width} onChange={(event) => changeLayout({ width: Math.max(320, Math.min(6000, Number(event.target.value) || 320)) })} /></label><label>Height (px)<input type="number" min="240" max="6000" value={figureLayout.height} onChange={(event) => changeLayout({ height: Math.max(240, Math.min(6000, Number(event.target.value) || 240)) })} /></label></div><div className="figure-layout-choices">{graphs.map((graph) => { const index = figureLayout.graphIds.indexOf(graph.id); return <div key={graph.id}><label><input type="checkbox" checked={index >= 0} disabled={index < 0 && figureLayout.graphIds.length >= 4} onChange={(event) => changeLayout({ graphIds: event.target.checked ? [...figureLayout.graphIds, graph.id] : figureLayout.graphIds.filter((id) => id !== graph.id) })} />{graph.name}</label>{index > 0 && <button aria-label={`Move ${graph.name} earlier`} onClick={() => { const ids = [...figureLayout.graphIds]; [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; changeLayout({ graphIds: ids }) }}>↑</button>}</div> })}</div><div ref={layoutPreviewRef} className="figure-layout-preview" style={{ gridTemplateColumns: `repeat(${Math.min(figureLayout.columns, Math.max(1, selectedLayoutGraphs.length))}, minmax(0, 1fr))` }}>{selectedLayoutGraphs.map((graph) => <div className="figure-layout-panel" data-legend-placement={graph.spec.legendPlacement ?? 'bottom'} key={graph.id}><strong>{graph.name}</strong><GraphCanvas preview={{ spec: graph.spec, filters: graph.filters }} /></div>)}</div><div className="project-actions"><button disabled={busy || !selectedLayoutGraphs.length} onClick={() => void exportLayout()}>{isDesktop() ? 'Save figure PNG…' : 'Download figure PNG'}</button></div><small>Graph edits update the page when you reopen it. PNG combines the current graphs and their legends.</small></>}</section>
        <section className="project-section"><h3>Reusable graph template</h3><p>Templates save the current graph and filters without data; import them with a dataset that has matching columns.</p><div className="project-actions"><label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} /></label><button onClick={() => void exportTemplate()}>{isDesktop() ? 'Save template…' : 'Download template'}</button><button disabled={busy} onClick={() => void chooseTemplate()}>Open template…</button></div></section>
        {legacyTemplates.length > 0 && <section className="project-section"><h3>Previous saved graphs</h3><p>Download each saved graph as a template before clearing this browser's data. Templates keep graph settings and filters, but need the original dataset when opened.</p><div className="project-graph-list">{legacyTemplates.map((template, index) => <div className="project-graph-item" key={`${template.name}-${index}`}><span>{template.name}</span><button onClick={() => downloadText(`${safeFileName(template.name)}.graphbuilder-template.json`, JSON.stringify(template, null, 2))}>Download template</button></div>)}</div></section>}
        <section className="project-section"><h3>Export open graph</h3><div className="project-dimensions"><label>Width (px)<input type="number" min="320" max="6000" value={width} onChange={(event) => setWidth(Math.max(320, Math.min(6000, Number(event.target.value) || 320)))} /></label><label>Height (px)<input type="number" min="240" max="6000" value={height} onChange={(event) => setHeight(Math.max(240, Math.min(6000, Number(event.target.value) || 240)))} /></label><label>PNG resolution<select value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></label></div><div className="project-actions"><button disabled={busy} onClick={() => void image('png')}>{isDesktop() ? 'Save PNG…' : 'Download PNG'}</button><button disabled={busy} onClick={() => void image('svg')}>{isDesktop() ? 'Save SVG…' : 'Download SVG'}</button><button disabled={busy} onClick={() => void clipboard()}>Copy PNG</button><button disabled={busy} onClick={() => void exportData()}>Export plotted data CSV</button></div><small>SVG is vector artwork that stays sharp when resized. PNG uses the chosen resolution. The export includes a printable legend.</small></section>
      </div>
      {message && <p className="project-message" role="status">{message}</p>}
      <input ref={projectInput} className="visually-hidden" type="file" tabIndex={-1} aria-label="Choose a project file" accept=".graphbuilder,.graphbuilder.json,.json" onChange={(event) => void readProject(event.target.files?.[0])} />
      <input ref={sourceInput} className="visually-hidden" type="file" tabIndex={-1} aria-label="Choose linked source data" accept=".csv,.tsv,.txt,.xlsx,.xls" onChange={(event) => void readLinkedSource(event.target.files?.[0])} />
      <input ref={templateInput} className="visually-hidden" type="file" tabIndex={-1} aria-label="Choose a graph template file" accept=".graphbuilder-template.json,.json" onChange={(event) => void importTemplate(event.target.files?.[0])} />
    </section>
  </div>
    {showSaveChoice && <div className="modal-backdrop project-decision-backdrop" role="presentation">
      <section ref={saveChoiceRef} className="project-decision project-save-choice" role="dialog" aria-modal="true" aria-labelledby="project-save-choice-title" tabIndex={-1}>
        <span className="eyebrow">SAVE PROJECT</span>
        <h2 id="project-save-choice-title">Save project</h2>
        <label>Project name<input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && !busy) { event.preventDefault(); void saveFile() } }} /></label>
        <label>Data in saved file<select value={mode} onChange={(event) => setMode(event.target.value as 'embedded' | 'linked')}><option value="embedded">Embedded — include data</option><option value="linked" disabled={!dataset.source?.fileName}>Linked — reconnect source</option></select></label>
        <small>Embedded keeps the data in the project file. Linked reconnects the original data file when opened.</small>
        {saveChoiceError && <p className="project-decision-error" role="alert">{saveChoiceError}</p>}
        <div className="project-decision-actions"><button type="button" disabled={busy} onClick={() => void saveFile()}>{busy ? 'Saving…' : 'Choose file location…'}</button><button type="button" className="secondary" disabled={busy} onClick={() => { setShowSaveChoice(false); setSaveChoiceError(undefined) }}>Cancel</button></div>
      </section>
    </div>}
    {(pendingOpen || openError) && <div className="modal-backdrop project-decision-backdrop" role="presentation">
      <section ref={decisionRef} className={`project-decision ${openError ? 'project-open-error' : ''}`} role={openError ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="project-decision-title" aria-describedby="project-decision-description" tabIndex={-1}>
        <span className="eyebrow">{openError ? 'PROJECT FILE ERROR' : 'OPEN PROJECT'}</span>
        <h2 id="project-decision-title">{openError ? 'Could not open project' : `Save before opening “${pendingOpen?.project.name}”?`}</h2>
        <p id="project-decision-description">{openError ?? 'Save an embedded copy of your current work before opening this file. Cancel keeps the current project on screen. After opening, Undo can restore it during this session.'}</p>
        {saveError && <p className="project-decision-error" role="alert">{saveError}</p>}
        <div className="project-decision-actions">
          {!openError && <button type="button" disabled={busy} onClick={() => void saveAndOpen()}>{busy ? 'Saving…' : 'Save current project and open'}</button>}
          {!openError && <button type="button" disabled={busy} className="discard" onClick={() => pendingOpen && completeOpen(pendingOpen)}>Discard edits and open</button>}
          <button type="button" disabled={busy} className="secondary" onClick={cancelOpen}>{openError ? 'Keep current project' : 'Cancel opening'}</button>
        </div>
      </section>
    </div>}
  </>
}
