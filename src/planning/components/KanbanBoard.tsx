import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { TaskCardView } from './TaskCard'
import type { PlanBoard, TaskCard } from '../types'

interface KanbanBoardProps {
  board: PlanBoard
  onMoveTask: (taskId: string, toColumn: string, insertIndex: number) => void
  onReorderTask: (taskId: string, insertIndex: number) => void
  onEditTask: (task: TaskCard) => void
  onCreateTask: (column: string) => void
  onToggleSubtask: (taskId: string, subtaskIndex: number) => void
}

export function KanbanBoard({
  board,
  onMoveTask,
  onReorderTask,
  onEditTask,
  onCreateTask,
  onToggleSubtask,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = board.tasks.find((item) => item.id === event.active.id)
      if (task) setActiveTask(task)
    },
    [board.tasks],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over?.id as string | undefined
      if (!overId) {
        setOverColumn(null)
        return
      }
      if (board.columns.includes(overId)) {
        setOverColumn(overId)
      } else {
        const overTask = board.tasks.find((item) => item.id === overId)
        if (overTask) setOverColumn(overTask.column)
      }
    },
    [board.columns, board.tasks],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveTask(null)
      setOverColumn(null)

      if (!over || !active) return

      const taskId = active.id as string
      const task = board.tasks.find((item) => item.id === taskId)
      if (!task) return

      const overId = over.id as string
      let targetColumn: string
      let insertIndex: number

      if (board.columns.includes(overId)) {
        targetColumn = overId
        insertIndex = board.tasks.filter((item) => item.column === targetColumn && item.id !== taskId).length
      } else {
        const overTask = board.tasks.find((item) => item.id === overId)
        if (!overTask) return
        targetColumn = overTask.column
        const columnTasks = board.tasks.filter((item) => item.column === targetColumn && item.id !== taskId)
        insertIndex = columnTasks.findIndex((item) => item.id === overId)
        if (insertIndex === -1) insertIndex = columnTasks.length
      }

      if (task.column === targetColumn) {
        onReorderTask(taskId, insertIndex)
      } else {
        onMoveTask(taskId, targetColumn, insertIndex)
      }
    },
    [board.tasks, board.columns, onMoveTask, onReorderTask],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {board.columns.map((column) => (
          <KanbanColumn
            key={column}
            column={column}
            tasks={board.tasks.filter((task) => task.column === column)}
            isOver={overColumn === column}
            onEditTask={onEditTask}
            onCreateTask={() => onCreateTask(column)}
            onToggleSubtask={onToggleSubtask}
          />
        ))}
      </div>

      <DragOverlay>{activeTask ? <TaskCardView task={activeTask} isDragging onEdit={() => undefined} /> : null}</DragOverlay>
    </DndContext>
  )
}
