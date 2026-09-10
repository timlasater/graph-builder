import { useDroppable } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DataColumn, GraphRole } from '../types'

function AssignmentChip({ column, role, index, onClear }: { column: DataColumn; role: GraphRole; index: number; onClear: () => void }) {
  const { setNodeRef, isDragging, isOver, transform, transition, listeners, attributes } = useSortable({ id: `assigned:${role}:${column.id}`, data: { columnId: column.id, fromRole: role, fromIndex: index, role, index } })
  return <span ref={setNodeRef} className={`assignment-target ${isOver ? 'assignment-over' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <span className={`assignment ${isDragging ? 'dragging' : ''}`} {...listeners} {...attributes}>
      {column.name}{column.unit ? ` (${column.unit})` : ''}<button onPointerDown={(event) => event.stopPropagation()} onClick={onClear} aria-label={`Remove ${column.name} from ${role}`}>×</button>
    </span>
  </span>
}

export function DropZone({ role, label, columns, onClear }: { role: GraphRole; label: string; columns: DataColumn[]; onClear: (columnId: string) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `role:${role}`, data: { role } })
  return <div ref={setNodeRef} className={`drop-zone ${isOver ? 'over' : ''} ${columns.length ? 'filled' : ''}`}>
    <span className="drop-label">{label}</span>
    {columns.length ? <SortableContext items={columns.map((column) => `assigned:${role}:${column.id}`)} strategy={role === 'y' ? verticalListSortingStrategy : horizontalListSortingStrategy}><span className="assignment-list">{columns.map((column, index) => <AssignmentChip key={column.id} column={column} role={role} index={index} onClear={() => onClear(column.id)} />)}</span></SortableContext> : <span className="drop-hint">Drop a variable here</span>}
  </div>
}
