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
  clickupId?: string
  clickupListId?: string
}

export interface PlanBoard {
  title: string
  columns: string[]
  tasks: TaskCard[]
}
