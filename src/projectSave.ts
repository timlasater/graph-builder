import { rememberProject, saveDesktopText, writeDesktopText } from './desktopFiles'
import { safeFileName } from './graphExport'
import { makeProject, projectJson } from './projects'
import { projectFingerprint, projectGraphs, useBuilderStore } from './store'

export async function saveCurrentDesktopProject(saveAs: boolean, forbiddenPath?: string): Promise<string | undefined> {
  const current = useBuilderStore.getState()
  const fingerprint = projectFingerprint({ ...current, projectMode: 'embedded' })
  const project = makeProject(current.projectName, current.dataset, projectGraphs(current), current.activeGraphId, 'embedded', current.figureLayout)
  const content = projectJson(project)
  let path = current.projectPath
  if (saveAs || !path) path = await saveDesktopText(`${safeFileName(project.name)}.graphbuilder`, content, 'graphbuilder', forbiddenPath)
  else await writeDesktopText(path, content)
  if (!path) return undefined
  useBuilderStore.getState().setProjectPath(path)
  useBuilderStore.getState().setProjectMode('embedded')
  useBuilderStore.getState().markProjectSaved(fingerprint)
  rememberProject(path, project.name)
  return path
}
