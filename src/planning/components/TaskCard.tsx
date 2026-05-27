import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TaskCard } from '../types'

interface TaskCardProps {
  task: TaskCard
  isDragging?: boolean
  onEdit: () => void
  onToggleSubtask?: (index: number) => void
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#3b82f6',
}

export function TaskCardView({ task, isDragging, onEdit }: TaskCardProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
    '--priority-color': PRIORITY_COLOR[task.priority] ?? '#334155',
  } as React.CSSProperties

  const isOverdue = task.deadline ? new Date(task.deadline) < new Date() : false
  const subtasksDone  = task.subtasks.filter((s) => s.done).length
  const subtasksTotal = task.subtasks.length

  const displayId = task.id.startsWith('task-') ? `#T-${task.id.slice(5)}` : `#${task.id}`

  const initials = task.assignee
    ? task.assignee.replace('@', '').substring(0, 2).toUpperCase()
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? 'task-dragging' : ''}`}
      onClick={onEdit}
      {...attributes}
      {...listeners}
    >
      <div className="task-top">
        <span className="task-id">{displayId}</span>
        <span className={`task-priority-chip priority-${task.priority}`}>{task.priority}</span>
      </div>

      <div className="task-title">{task.title}</div>

      {task.description && (
        <div className="task-desc">{task.description}</div>
      )}

      {subtasksTotal > 0 && (
        <div className="task-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(subtasksDone / subtasksTotal) * 100}%` }}
            />
          </div>
          <span className="progress-text">{subtasksDone}/{subtasksTotal}</span>
        </div>
      )}

      <div className="task-footer">
        <div className="task-tags">
          {task.output && <span className="task-tag brief-tag">brief</span>}
          {task.milestone && <span className="task-tag milestone-tag">{task.milestone}</span>}
          {(task.depends?.length ?? 0) > 0 && (
            <span className="task-tag depends-tag">&#8627;{task.depends!.length}</span>
          )}
          {task.deadline && (
            <span className={`task-tag deadline-tag ${isOverdue ? 'overdue' : ''}`}>
              {task.deadline}
            </span>
          )}
        </div>
        {initials && (
          <div className="task-avatar" title={task.assignee}>{initials}</div>
        )}
      </div>
    </div>
  )
}
