import { useEffect, useState } from 'react'
import { makeProject, type ProjectFile } from './projects'
import { clearRecovery, readRecovery, saveRecovery } from './recovery'
import { projectGraphs, useBuilderStore } from './store'
import { sampleDataset } from './sampleData'

const restoreProject = (saved: ProjectFile) => {
  if (saved.data.mode !== 'embedded') return
  useBuilderStore.getState().openProject(saved.name, saved.data.dataset, saved.graphs, saved.activeGraphId, undefined, 'embedded', saved.figureLayout)
  useBuilderStore.getState().markProjectSaved(undefined)
}

export function useProjectRecovery() {
  const [recovery, setRecovery] = useState<ProjectFile>()
  const [checked, setChecked] = useState(false)
  const [status, setStatus] = useState('Checking local recovery…')

  useEffect(() => {
    let active = true
    void readRecovery().then((saved) => {
      if (!active) return
      const current = useBuilderStore.getState()
      const unchanged = saved?.data.mode === 'embedded' && saved.name === current.projectName && saved.activeGraphId === current.activeGraphId && JSON.stringify(saved.data.dataset) === JSON.stringify(current.dataset) && JSON.stringify(saved.graphs) === JSON.stringify(projectGraphs(current))
      const exampleOnly = saved?.data.mode === 'embedded' && JSON.stringify(saved.data.dataset) === JSON.stringify(sampleDataset)
      if (exampleOnly) { if (!unchanged) restoreProject(saved!); setChecked(true); setStatus('Autosave is on.') }
      else if (saved?.data.mode === 'embedded' && !unchanged) { setRecovery(saved); setStatus(`Autosave from ${new Date(saved.savedAt).toLocaleString()} is available.`) }
      else { setChecked(true); setStatus('Autosave is on.') }
    }).catch(() => { if (active) { setChecked(true); setStatus('Local recovery could not be read; your current work is unchanged.') } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!checked || recovery) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let queue = Promise.resolve()
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const state = useBuilderStore.getState()
        try {
          const project = makeProject(state.projectName, state.dataset, projectGraphs(state), state.activeGraphId, 'embedded', state.figureLayout)
          queue = queue.catch(() => undefined).then(() => saveRecovery(project))
          void queue.then(() => setStatus(`Autosaved locally at ${new Date().toLocaleTimeString()}.`)).catch(() => setStatus('Autosave is unavailable. Download an embedded project to protect your work.'))
        } catch { setStatus('Autosave is unavailable. Download an embedded project to protect your work.') }
      }, 1200)
    }
    const unsubscribe = useBuilderStore.subscribe((state, previous) => {
      if (state.dataset !== previous.dataset || state.spec !== previous.spec || state.filters !== previous.filters || state.projectName !== previous.projectName || state.activeGraphName !== previous.activeGraphName || state.activeGraphId !== previous.activeGraphId || state.otherGraphs !== previous.otherGraphs || state.figureLayout !== previous.figureLayout) schedule()
    })
    return () => { unsubscribe(); if (timer) clearTimeout(timer) }
  }, [checked, recovery])

  const restore = () => {
    if (!recovery || recovery.data.mode !== 'embedded') return
    restoreProject(recovery)
    setRecovery(undefined); setChecked(true); setStatus('Autosaved project restored.')
  }
  const dismiss = async () => {
    try { await clearRecovery() } catch { /* A new autosave will replace an unreadable entry. */ }
    setRecovery(undefined); setChecked(true); setStatus('Started with the current example. Autosave is on.')
  }
  return { recovery, ready: checked, status, restore, dismiss }
}
