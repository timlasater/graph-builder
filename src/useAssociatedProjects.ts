import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'

export function useAssociatedProjects(desktop: boolean) {
  const [paths, setPaths] = useState<string[]>([])

  useEffect(() => {
    if (!desktop) return
    let active = true
    let unlisten: (() => void) | undefined
    const receive = async () => {
      try {
        const incoming = await invoke<string[]>('take_pending_project_paths')
        if (active && incoming.length) setPaths((current) => [...current, ...incoming])
      } catch (error) {
        console.error('Could not receive a project opened from Windows.', error)
      }
    }
    void listen('project-file-open', () => { void receive() }).then((stop) => {
      if (!active) stop()
      else { unlisten = stop; void receive() }
    }).catch(() => { void receive() })
    return () => { active = false; unlisten?.() }
  }, [desktop])

  return { path: paths[0], finish: () => setPaths((current) => current.slice(1)) }
}
