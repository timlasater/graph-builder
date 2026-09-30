import { useState } from 'react'

export function MovingAverageWindow({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))

  const commit = () => {
    const parsed = Number(draft)
    const next = draft.trim() === '' || !Number.isFinite(parsed) ? 1 : Math.max(1, Math.min(99, Math.floor(parsed) | 1))
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return <input type="number" min="1" max="99" step="2" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
}
