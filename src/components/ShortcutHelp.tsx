import { useEffect } from 'react'
import { useDialogFocus } from '../useDialogFocus'

export function ShortcutHelp({ desktop, onClose, onFullGuide }: { desktop: boolean; onClose: () => void; onFullGuide: () => void }) {
  const dialogRef = useDialogFocus<HTMLElement>()

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop shortcut-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" tabIndex={-1}>
      <header><div><span className="eyebrow">KEYBOARD HELP</span><h2 id="shortcut-title">Keyboard shortcuts</h2></div><button className="dialog-close" aria-label="Close keyboard shortcuts" onClick={onClose}>×</button></header>
      <dl className="shortcut-list">
        {desktop && <><div><dt>Ctrl+N</dt><dd>New empty graph in this project</dd></div><div><dt>Ctrl+D</dt><dd>Open data table</dd></div><div><dt>Ctrl+O</dt><dd>Open data or a project</dd></div><div><dt>Ctrl+S</dt><dd>Save project</dd></div><div><dt>Ctrl+Shift+S</dt><dd>Save project as a new file</dd></div><div><dt>Ctrl+E</dt><dd>Projects &amp; export</dd></div></>}
        <div><dt>Ctrl+Z / Ctrl+Y</dt><dd>Undo / redo outside text fields</dd></div>
        {desktop && <div><dt>Mouse Back / Forward</dt><dd>Undo / redo graph changes</dd></div>}
        <div><dt>?</dt><dd>Show this list</dd></div>
        <div><dt>Tab / Shift+Tab</dt><dd>Move between controls</dd></div>
        <div><dt>Enter / Space</dt><dd>Use the focused control</dd></div>
        <div><dt>Escape</dt><dd>Close a dialog or cancel an action</dd></div>
      </dl>
      <div className="shortcut-actions"><button onClick={onFullGuide}>Open full user guide</button></div>
    </section>
  </div>
}
