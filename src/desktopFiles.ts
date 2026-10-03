import { isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, readTextFile, stat, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'

export const isDesktop = () => isTauri()

const basename = (path: string) => path.split(/[\\/]/).at(-1) || path

const dataExtensions = ['csv', 'tsv', 'txt', 'xlsx', 'xls']
const projectExtensions = ['graphbuilder', 'graphbuilder.json']

export const desktopOpenKind = (path: string): 'data' | 'project' | undefined => {
  const lower = path.toLocaleLowerCase()
  if (lower.endsWith('.graphbuilder') || lower.endsWith('.graphbuilder.json') || lower.endsWith('.json')) return 'project'
  return dataExtensions.some((extension) => lower.endsWith(`.${extension}`)) ? 'data' : undefined
}

export const chooseDesktopFile = async (kind: 'data' | 'project' | 'source' | 'template' | 'open', lastKnownPath?: string) => {
  const separator = lastKnownPath ? Math.max(lastKnownPath.lastIndexOf('\\'), lastKnownPath.lastIndexOf('/')) : -1
  const lastKnownDirectory = separator < 0 ? undefined : lastKnownPath!.slice(0, separator === 2 && lastKnownPath![1] === ':' ? 3 : separator || 1)
  const options = { multiple: false, directory: false, filters: [{ name: kind === 'open' ? 'Data or Graph Builder project' : kind === 'project' ? 'Graph Builder project' : kind === 'template' ? 'Graph Builder template' : 'Data file', extensions: kind === 'open' ? [...dataExtensions, ...projectExtensions, 'json'] : kind === 'project' ? projectExtensions : kind === 'template' ? ['graphbuilder-template.json'] : dataExtensions }] }
  let path
  if (lastKnownDirectory) {
    try { path = await open({ ...options, defaultPath: lastKnownDirectory }) }
    catch { path = await open(options) }
  } else path = await open(options)
  return typeof path === 'string' ? path : undefined
}

export const readDesktopFile = async (path: string) => {
  const bytes = await readFile(path)
  return new File([new Uint8Array(bytes)], basename(path))
}

export const readDesktopProject = async (path: string) => {
  if ((await stat(path)).size > 100 * 1024 * 1024) throw new Error('This project file is too large to open safely (100 MB limit).')
  return readTextFile(path)
}

const pathKey = (path: string) => path.replace(/\//g, '\\').replace(/\\+$/, '').toLocaleLowerCase()
export const sameDesktopPath = (left: string, right: string) => pathKey(left) === pathKey(right)

export const saveDesktopText = async (name: string, content: string, extension: string, forbiddenPath?: string) => {
  const path = await save({ defaultPath: name, filters: [{ name: 'Graph Builder file', extensions: [extension] }] })
  if (!path) return undefined
  if (forbiddenPath && sameDesktopPath(path, forbiddenPath)) throw new Error('Choose a different file name for the current project. The project you are opening was not overwritten.')
  await writeTextFile(path, content)
  return path
}

export const saveDesktopImage = async (name: string, imageUrl: string, extension: 'png' | 'svg') => {
  const path = await save({ defaultPath: name, filters: [{ name: `${extension.toUpperCase()} image`, extensions: [extension] }] })
  if (!path) return undefined
  const bytes = new Uint8Array(await (await fetch(imageUrl)).arrayBuffer())
  await writeFile(path, bytes)
  return path
}

const RECENT_KEY = 'graph-builder-recent-projects'
export interface RecentProject { path: string; name: string }
const uniqueRecent = (items: RecentProject[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = pathKey(item.path)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 10)
}

export const writeDesktopText = (path: string, content: string) => writeTextFile(path, content)
export const recentProjects = (): RecentProject[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed) ? uniqueRecent(parsed.filter((item): item is RecentProject => Boolean(item) && typeof item.path === 'string' && typeof item.name === 'string')) : []
  } catch { return [] }
}
export const rememberProject = (path: string, name: string) => {
  localStorage.setItem(RECENT_KEY, JSON.stringify(uniqueRecent([{ path, name }, ...recentProjects()])))
}
export const clearRecentProjects = () => localStorage.removeItem(RECENT_KEY)
