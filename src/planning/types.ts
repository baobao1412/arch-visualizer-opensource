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
  output?: string
}

export interface PlanBoard {
  title: string
  columns: string[]
  tasks: TaskCard[]
}
