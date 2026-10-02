export type NavigationShortcut = 'projects' | 'newGraph' | 'help'

export function navigationShortcut(event: KeyboardEvent, desktop: boolean, modalOpen: boolean): NavigationShortcut | undefined {
  if (modalOpen) return undefined
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], .ag-root'))) return undefined
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'n') return 'newGraph'
  if (desktop && event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'e') return 'projects'
  if (!event.ctrlKey && !event.altKey && !event.metaKey && (event.key === '?' || event.key === '/' && event.shiftKey)) return 'help'
  return undefined
}
