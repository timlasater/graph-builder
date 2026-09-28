import { useState, type ReactNode } from 'react'

export function CollapsibleSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(true)
  return <section className={`property-section ${className}`}>
    <h3><button type="button" className="property-section-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span aria-hidden="true">{open ? '▾' : '▸'}</span>{title}</button></h3>
    {open && <div className="property-section-content">{children}</div>}
  </section>
}
