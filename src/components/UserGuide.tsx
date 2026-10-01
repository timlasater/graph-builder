import { useEffect } from 'react'
import Markdown from 'react-markdown'
import guide from '../../docs/user-guide.md?raw'
import workspaceImage from '../../docs/screenshots/workspace.png'
import projectsImage from '../../docs/screenshots/projects.png'
import { useDialogFocus } from '../useDialogFocus'

const images: Record<string, string> = {
  'screenshots/workspace.png': workspaceImage,
  'screenshots/projects.png': projectsImage,
}

export default function UserGuide({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogFocus<HTMLElement>()

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="guide-dialog" role="dialog" aria-modal="true" aria-label="User guide" tabIndex={-1}>
      <header><strong>User guide</strong><button className="dialog-close" aria-label="Close user guide" onClick={onClose}>×</button></header>
      <div className="guide-content"><Markdown components={{ img: ({ src, alt }) => <img src={images[src ?? ''] ?? src} alt={alt ?? ''} /> }}>{guide}</Markdown></div>
    </section>
  </div>
}
