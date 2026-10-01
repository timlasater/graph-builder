import { isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, readTextFile, stat, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'

export const isDesktop = () => isTauri()

const basename = (path: string) => path.split(/[\\/]/).at(-1) || path

const dataExtensions = ['csv', 'tsv', 'txt', 'xlsx', 'xls']
const projectExtensions = ['graphbuilder', 'graphbuilder.json']

export const chooseDesktopFile = async (kind: 'data' | 'project' | 'source' | 'template') => {
  const path = await open({ multiple: false, directory: false, filters: [{ name: kind === 'project' ? 'Graph Builder project' : kind === 'template' ? 'Graph Builder template' : 'Data file', extensions: kind === 'project' ? projectExtensions : kind === 'template' ? ['graphbuilder-template.json'] : dataExtensions }] })
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

export const saveDesktopText = async (name: string, content: string, extension: string) => {
  const path = await save({ defaultPath: name, filters: [{ name: 'Graph Builder file', extensions: [extension] }] })
  if (!path) return undefined
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
export const recentProjects = (): RecentProject[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is RecentProject => Boolean(item) && typeof item.path === 'string' && typeof item.name === 'string').slice(0, 10) : []
  } catch { return [] }
}
export const rememberProject = (path: string, name: string) => {
  localStorage.setItem(RECENT_KEY, JSON.stringify([{ path, name }, ...recentProjects().filter((item) => item.path !== path)].slice(0, 10)))
}
