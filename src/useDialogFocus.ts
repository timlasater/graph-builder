import { useEffect, useRef } from 'react'

const focusable = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogFocus<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!active || !dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter((item) => item.getClientRects().length > 0 && !item.classList.contains('visually-hidden'))
    ;(controls()[0] ?? dialog).focus()
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = controls()
      if (!items.length) { event.preventDefault(); dialog.focus(); return }
      const first = items[0]; const last = items.at(-1)!
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keepFocus)
    return () => { document.removeEventListener('keydown', keepFocus); previous?.focus() }
  }, [active])
  return ref
}
