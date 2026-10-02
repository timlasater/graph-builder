import { rememberProject, saveDesktopText, writeDesktopText } from './desktopFiles'
import { safeFileName } from './graphExport'
import { makeProject, projectJson } from './projects'
import { projectGraphs, useBuilderStore } from './store'

export async function saveCurrentDesktopProject(saveAs: boolean): Promise<string | undefined> {
  const current = useBuilderStore.getState()
  const project = makeProject(current.projectName, current.dataset, projectGraphs(current), current.activeGraphId, 'embedded')
  const content = projectJson(project)
  let path = current.projectPath
  if (saveAs || !path) path = await saveDesktopText(`${safeFileName(project.name)}.graphbuilder`, content, 'graphbuilder')
  else await writeDesktopText(path, content)
  if (!path) return undefined
  useBuilderStore.getState().setProjectPath(path)
  rememberProject(path, project.name)
  return path
}
