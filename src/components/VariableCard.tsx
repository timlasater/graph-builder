import { useDraggable } from '@dnd-kit/core'
import type { DataColumn } from '../types'

const typeSymbol = (column: DataColumn) => column.modelingType === 'continuous' ? '▰' : column.modelingType === 'ordinal' ? '▥' : '●'

export function VariableCard({ column, selected, onSelect }: { column: DataColumn; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `column:${column.id}`,
    data: { columnId: column.id },
  })

  return (
    <button
      ref={setNodeRef}
      className={`variable-card ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <span className={`type-symbol ${column.modelingType}`} aria-hidden="true">{typeSymbol(column)}</span>
      <span className="variable-name">{column.name}</span>
      {column.unit && <span className="unit">{column.unit}</span>}
    </button>
  )
}
