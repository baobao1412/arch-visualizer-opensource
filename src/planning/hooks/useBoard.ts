import { useCallback, useEffect, useState } from 'react'
import type { PlanBoard, TaskCard } from '../types'

type IncomingMessage =
  | { type: 'loadBoard'; board: PlanBoard; filePath: string }
  | { type: 'boardUpdated'; board: PlanBoard }
  | { type: 'error'; message: string }
  | { type: 'noFile' }

type OutgoingAction =
  | { type: 'moveTask'; taskId: string; toColumn: string; insertIndex: number }
  | { type: 'reorderTask'; taskId: string; insertIndex: number }
  | { type: 'createTask'; task: Omit<TaskCard, 'id'> }
  | { type: 'updateTask'; task: TaskCard }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'toggleSubtask'; taskId: string; subtaskIndex: number }

type OnMessage = (handler: (msg: unknown) => void) => () => void
type PostMessage = (msg: unknown) => void

const LOCAL_STORAGE_KEY = 'archviz.planning.board'

const DEFAULT_BOARD: PlanBoard = {
  title: 'Sprint 1',
  columns: ['Todo', 'In Progress', 'Review', 'Done'],
  tasks: [],
}

export function useBoard(onMessage: OnMessage, postMessage: PostMessage, isVscode: boolean) {
  const [board, setBoard] = useState<PlanBoard | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)

  useEffect(() => {
    if (isVscode) return

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as PlanBoard
      if (parsed?.columns?.length) {
        setBoard(parsed)
        setFilePath('local-storage.plan.md')
      }
    } catch {
      // no-op
    }
  }, [isVscode])

  useEffect(() => {
    return onMessage((msg: unknown) => {
      const data = msg as IncomingMessage
      switch (data.type) {
        case 'loadBoard':
          setBoard(data.board)
          setFilePath(data.filePath)
          break
        case 'boardUpdated':
          setBoard(data.board)
          break
        case 'noFile':
          setBoard(null)
          setFilePath(null)
          break
        case 'error':
          console.error('[PlanningBoard]', data.message)
          break
        default:
          break
      }
    })
  }, [onMessage])

  useEffect(() => {
    if (!isVscode && board) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(board))
    }
  }, [board, isVscode])

  const createLocalPlan = useCallback(() => {
    setBoard(DEFAULT_BOARD)
    setFilePath('local-storage.plan.md')
  }, [])

  const dispatch = useCallback((action: OutgoingAction) => {
    if (isVscode) {
      postMessage(action)
      return
    }

    setBoard((prev) => {
      if (!prev) return prev

      switch (action.type) {
        case 'moveTask': {
          const task = prev.tasks.find((t) => t.id === action.taskId)
          if (!task) return prev
          const moved = { ...task, column: action.toColumn }
          const columnTasks = prev.tasks.filter((t) => t.column === action.toColumn && t.id !== action.taskId)
          const others = prev.tasks.filter((t) => t.column !== action.toColumn && t.id !== action.taskId)
          columnTasks.splice(action.insertIndex, 0, moved)
          return { ...prev, tasks: reorderByColumns(prev.columns, [...others, ...columnTasks]) }
        }
        case 'reorderTask': {
          const task = prev.tasks.find((t) => t.id === action.taskId)
          if (!task) return prev
          const columnTasks = prev.tasks.filter((t) => t.column === task.column && t.id !== action.taskId)
          const others = prev.tasks.filter((t) => t.column !== task.column)
          columnTasks.splice(action.insertIndex, 0, task)
          return { ...prev, tasks: reorderByColumns(prev.columns, [...others, ...columnTasks]) }
        }
        case 'createTask': {
          const nextId = generateTaskId(prev.tasks)
          const created: TaskCard = { id: nextId, ...action.task, output: `briefs/${nextId}.md` }
          return { ...prev, tasks: [...prev.tasks, created] }
        }
        case 'updateTask': {
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === action.task.id ? action.task : t)),
          }
        }
        case 'deleteTask': {
          return { ...prev, tasks: prev.tasks.filter((t) => t.id !== action.taskId) }
        }
        case 'toggleSubtask': {
          return {
            ...prev,
            tasks: prev.tasks.map((t) => {
              if (t.id !== action.taskId) return t
              if (!t.subtasks[action.subtaskIndex]) return t
              const subtasks = [...t.subtasks]
              subtasks[action.subtaskIndex] = {
                ...subtasks[action.subtaskIndex],
                done: !subtasks[action.subtaskIndex].done,
              }
              return { ...t, subtasks }
            }),
          }
        }
        default:
          return prev
      }
    })
  }, [isVscode, postMessage])

  return { board, filePath, dispatch, createLocalPlan }
}

function reorderByColumns(columns: string[], tasks: TaskCard[]): TaskCard[] {
  const ordered: TaskCard[] = []
  for (const col of columns) {
    ordered.push(...tasks.filter((task) => task.column === col))
  }
  return ordered
}

function generateTaskId(existing: TaskCard[]): string {
  let max = 0
  for (const item of existing) {
    const match = /^task-(\d+)$/.exec(item.id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `task-${max + 1}`
}
