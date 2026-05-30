import { useCallback, useEffect, useState } from 'react'
import { KanbanBoard } from './components/KanbanBoard'
import { EmptyState } from './components/EmptyState'
import { TaskForm } from './components/TaskForm'
import { useBoard } from './hooks/useBoard'
import { useVscodeMessaging } from './hooks/useVscodeMessaging'
import type { BriefContent, TaskCard } from './types'

const BRIEF_STORAGE_KEY = 'archviz.planning.briefs'

type BriefMap = Record<string, BriefContent>

export default function PlanningApp() {
  const { postMessage, onMessage, isVscode } = useVscodeMessaging()
  const { board, filePath, dispatch, createLocalPlan } = useBoard(onMessage, postMessage, isVscode)
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createColumn, setCreateColumn] = useState('')
  const [currentBrief, setCurrentBrief] = useState<BriefContent | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [localBriefs, setLocalBriefs] = useState<BriefMap>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(BRIEF_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as BriefMap) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (isVscode) postMessage({ type: 'ready' })
  }, [isVscode, postMessage])

  useEffect(() => {
    if (!isVscode) {
      localStorage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(localBriefs))
    }
  }, [localBriefs, isVscode])

  useEffect(() => {
    return onMessage((msg: unknown) => {
      const data = msg as { type: string; taskId?: string; brief?: BriefContent }
      if (data.type === 'briefLoaded') {
        setCurrentBrief(data.brief || null)
        setBriefLoading(false)
      }
    })
  }, [onMessage])

  const handleCreateTask = useCallback((column: string) => {
    setCreateColumn(column)
    setIsCreating(true)
    setEditingTask(null)
    setCurrentBrief(null)
    setBriefLoading(false)
  }, [])

  const handleEditTask = useCallback(
    (task: TaskCard) => {
      setEditingTask(task)
      setIsCreating(false)
      setBriefLoading(false)

      if (isVscode) {
        setCurrentBrief(null)
        setBriefLoading(true)
        postMessage({ type: 'loadBrief', taskId: task.id })
      } else {
        setCurrentBrief(localBriefs[task.id] || null)
      }
    },
    [isVscode, localBriefs, postMessage],
  )

  const handleSaveTask = useCallback(
    (task: Omit<TaskCard, 'id'> & { id?: string }, brief: BriefContent | null) => {
      let targetId = task.id
      if (task.id) {
        dispatch({ type: 'updateTask', task: task as TaskCard })
      } else {
        dispatch({ type: 'createTask', task })
      }

      if (isVscode) {
        if (brief && targetId) {
          postMessage({ type: 'saveBrief', taskId: targetId, brief })
        }
      } else {
        if (!targetId) {
          const ids = Object.keys(localBriefs)
          const next = ids
            .map((id) => /^task-(\d+)$/.exec(id)?.[1])
            .filter(Boolean)
            .map(Number)
          const max = next.length ? Math.max(...next) : 0
          targetId = `task-${max + 1}`
        }

        if (brief && targetId) {
          setLocalBriefs((prev) => ({ ...prev, [targetId!]: brief }))
        }
      }

      setEditingTask(null)
      setIsCreating(false)
      setCurrentBrief(null)
    },
    [dispatch, isVscode, localBriefs, postMessage],
  )

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      dispatch({ type: 'deleteTask', taskId })
      if (!isVscode) {
        setLocalBriefs((prev) => {
          const next = { ...prev }
          delete next[taskId]
          return next
        })
      }
      setEditingTask(null)
      setCurrentBrief(null)
    },
    [dispatch, isVscode],
  )

  const handleCloseForm = useCallback(() => {
    setEditingTask(null)
    setIsCreating(false)
    setCurrentBrief(null)
  }, [])

  const handleToggleSubtask = useCallback(
    (taskId: string, subtaskIndex: number) => {
      dispatch({ type: 'toggleSubtask', taskId, subtaskIndex })
      if (isVscode) {
        postMessage({ type: 'toggleSubtask', taskId, subtaskIndex })
      }
    },
    [dispatch, isVscode, postMessage],
  )

  if (!board) {
    return (
      <EmptyState
        isVscode={isVscode}
        onOpenFile={() => postMessage({ type: 'openPlanFile' })}
        onCreateFile={() => {
          if (isVscode) {
            postMessage({ type: 'createPlanFile' })
          } else {
            createLocalPlan()
          }
        }}
      />
    )
  }

  const totalTasks    = board.tasks.length
  const inProgress    = board.tasks.filter((t) => t.column.toLowerCase().replace(/\s+/g, '') === 'inprogress').length

  return (
    <div className="planning-root">
      <div className="planning-header">
        <span className="planning-title">{board.title}</span>
        {totalTasks > 0 && (
          <span className="planning-task-summary">
            {totalTasks} task{totalTasks !== 1 ? 's' : ''}
            {inProgress > 0 && <> · <span>{inProgress} in progress</span></>}
          </span>
        )}
        <div className="planning-header-spacer" />
        {filePath ? (
          <span className="planning-filepath" title={filePath}>
            {filePath.split(/[/\\]/).pop()}
          </span>
        ) : null}
        <span className="planning-sync-dot" title="Synced" />
      </div>

      <KanbanBoard
        board={board}
        onMoveTask={(taskId, toColumn, insertIndex) => dispatch({ type: 'moveTask', taskId, toColumn, insertIndex })}
        onReorderTask={(taskId, insertIndex) => dispatch({ type: 'reorderTask', taskId, insertIndex })}
        onEditTask={handleEditTask}
        onCreateTask={handleCreateTask}
        onToggleSubtask={handleToggleSubtask}
      />

      {isCreating || editingTask ? (
        <TaskForm
          key={`${editingTask?.id || 'new'}:${currentBrief ? 'brief' : 'nobrief'}`}
          task={editingTask}
          defaultColumn={createColumn || board.columns[0]}
          columns={board.columns}
          brief={currentBrief}
          briefLoading={briefLoading}
          onSave={handleSaveTask}
          onDelete={editingTask ? () => handleDeleteTask(editingTask.id) : undefined}
          onClose={handleCloseForm}
        />
      ) : null}
    </div>
  )
}
