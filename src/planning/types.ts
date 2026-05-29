export interface TaskComment {
  author: string
  text: string
  timestamp: string
  type: 'review' | 'note' | 'rework'
}

export interface Subtask {
  text: string
  done: boolean
}

export interface BriefContent {
  context: string
  expectedOutput: string
  acceptanceCriteria: string
  technicalNotes: string
  rulesFormat: string
}

export interface TaskCard {
  id: string
  title: string
  description: string
  milestone?: string
  deadline?: string
  priority: 'high' | 'medium' | 'low'
  column: string
  assignee?: string
  depends?: string[]
  subtasks: Subtask[]
  comments?: TaskComment[]
  output?: string
}

export interface PlanBoard {
  title: string
  columns: string[]
  tasks: TaskCard[]
}

export type IncomingPlanMessage =
  | { type: 'ready' }
  | { type: 'moveTask'; taskId: string; toColumn: string; insertIndex: number }
  | { type: 'createTask'; task: Omit<TaskCard, 'id'> }
  | { type: 'updateTask'; task: TaskCard }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'reorderTask'; taskId: string; insertIndex: number }
  | { type: 'openPlanFile' }
  | { type: 'createPlanFile' }
  | { type: 'addColumn'; name: string }
  | { type: 'renameColumn'; oldName: string; newName: string }
  | { type: 'deleteColumn'; name: string }
  | { type: 'toggleSubtask'; taskId: string; subtaskIndex: number }
  | { type: 'loadBrief'; taskId: string }
  | { type: 'saveBrief'; taskId: string; brief: BriefContent }
  | { type: 'triggerRework'; taskId: string; provider: 'copilot' | 'claude' | 'prompt' }

export type OutgoingPlanMessage =
  | { type: 'loadBoard'; board: PlanBoard; filePath: string }
  | { type: 'boardUpdated'; board: PlanBoard }
  | { type: 'error'; message: string }
  | { type: 'noFile' }
  | { type: 'briefLoaded'; taskId: string; brief: BriefContent }
