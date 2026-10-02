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

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

// The bundled Markdown renderer does not include GitHub's table extension.
// Present the guide's compact tables as labeled lists inside the app.
const guideForApp = guide.replace(/^(\|[^\n]+\|)\n(\|[\s:|-]+\|)\n((?:\|[^\n]+\|\n?)*)/gm, (_match, header: string, _separator: string, body: string) => {
  const headings = header.split('|').slice(1, -1).map((cell) => cell.trim())
  return body.trim().split('\n').map((row) => {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim())
    return `- **${cells[0]}** — ${cells.slice(1).map((cell, index) => headings[index + 1] ? `${headings[index + 1]}: ${cell}` : cell).join('; ')}`
  }).join('\n') + '\n'
})

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
      <div className="guide-content"><Markdown components={{ h2: ({ children }) => <h2 id={slug(String(children))}>{children}</h2>, img: ({ src, alt }) => <img src={images[src ?? ''] ?? src} alt={alt ?? ''} /> }}>{guideForApp}</Markdown></div>
    </section>
  </div>
}
