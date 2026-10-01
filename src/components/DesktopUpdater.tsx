import { useEffect, useRef, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'

export function DesktopUpdater({ saveBeforeInstall, onInstalling }: { saveBeforeInstall: () => Promise<boolean>; onInstalling: (installing: boolean) => void }) {
  const [available, setAvailable] = useState<Update>()
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [status, setStatus] = useState('')
  const checkedOnOpen = useRef(false)

  const checkForUpdates = async (showResult: boolean) => {
    setChecking(true)
    try {
      const found = await check({ timeout: 10_000 })
      setAvailable(found ?? undefined)
      setStatus(found ? `Version ${found.version} is available.` : showResult ? 'Graph Builder is up to date.' : '')
    } catch {
      if (showResult) setStatus('Could not check for updates. Check your connection and try again.')
    } finally { setChecking(false) }
  }

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active && !checkedOnOpen.current) { checkedOnOpen.current = true; void checkForUpdates(false) } })
    return () => { active = false }
  }, [])
  useEffect(() => () => { if (available) void available.close() }, [available])

  const install = async () => {
    if (!available) return
    if (!await saveBeforeInstall()) { setStatus('Update cancelled. Save an embedded project to keep your current work.'); return }
    setInstalling(true); onInstalling(true)
    setStatus('Downloading signed update…')
    try {
      let downloaded = 0
      await available.downloadAndInstall((event) => {
        if (event.event === 'Started') downloaded = 0
        if (event.event === 'Progress') downloaded += event.data.chunkLength
        if (event.event === 'Finished') setStatus('Installing update… Graph Builder will restart.')
        else if (downloaded) setStatus(`Downloading signed update… ${Math.round(downloaded / 1024)} KB`)
      })
    } catch (error) {
      setStatus(error instanceof Error ? `Update failed: ${error.message}` : 'Update failed. Please try again.')
      setInstalling(false); onInstalling(false)
    }
  }

  return <section className="project-section"><h3>Desktop updates</h3><div className="project-actions"><button disabled={checking || installing} onClick={() => void checkForUpdates(true)}>{checking ? 'Checking…' : 'Check for updates'}</button>{available && <button disabled={checking || installing} onClick={() => void install()}>Save project and install {available.version}</button>}</div><small role="status">{status || 'Updates are checked when you open this panel. Installing asks you to save a full project copy first.'}</small></section>
}
