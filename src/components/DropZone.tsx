import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { DataColumn, GraphRole } from '../types'

export function DropZone({ role, label, column, onClear }: { role: GraphRole; label: string; column?: DataColumn; onClear: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `role:${role}`, data: { role } })
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: `assignment:${role}`,
    disabled: !column,
    data: { columnId: column?.id, fromRole: role },
  })
  return (
    <div ref={setNodeRef} className={`drop-zone ${isOver ? 'over' : ''} ${column ? 'filled' : ''}`}>
      <span className="drop-label">{label}</span>
      {column ? (
        <span
          ref={setDraggableRef}
          className={`assignment ${isDragging ? 'dragging' : ''}`}
          style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
          {...listeners}
          {...attributes}
        >
          {column.name}{column.unit ? ` (${column.unit})` : ''}
          <button onPointerDown={(event) => event.stopPropagation()} onClick={onClear} aria-label={`Remove ${column.name} from ${label}`}>×</button>
        </span>
      ) : <span className="drop-hint">Drop a variable here</span>}
    </div>
  )
}
