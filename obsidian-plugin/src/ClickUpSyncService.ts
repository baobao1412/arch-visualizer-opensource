import { Vault, TFile, Notice } from 'obsidian'
import { TaskCard, PlanBoard } from './types'

const CU_STATUS_TO_LOCAL: Record<string, string> = {
  'to do': 'Todo',
  'in progress': 'In Progress',
  'review': 'Review',
  'complete': 'Done',
  'closed': 'Done',
}

const LOCAL_TO_CU_STATUS: Record<string, string> = {
  'todo': 'to do',
  'in progress': 'in progress',
  'review': 'review',
  'done': 'complete',
}

// CU priority: 1=urgent, 2=high, 3=normal, 4=low
const LOCAL_TO_CU_PRIORITY: Record<string, number> = {
  high: 2,
  medium: 3,
  low: 4,
}

interface CUTask {
  id: string
  name: string
  description: string
  markdown_description?: string
  status: { status: string }
  due_date: string | null
  assignees: { username: string; email?: string }[]
  priority: { priority: string } | null
  checklists: { items: { name: string; resolved: boolean }[] }[]
  custom_fields?: { name: string; value: unknown }[]
}

interface CUComment {
  id: string
  comment_text: string
  user: { username: string }
  date: string
}

export interface SyncResult {
  added: number
  updated: number
  briefs: number
  errors: string[]
}

export class ClickUpSyncService {
  constructor(
    private token: string,
    private listId: string,
    private vault: Vault,
  ) { }

  async pullFromClickUp(board: PlanBoard): Promise<{ board: PlanBoard } & SyncResult> {
    const result: SyncResult = { added: 0, updated: 0, briefs: 0, errors: [] }

    if (!this.token || !this.listId) {
      new Notice('⚠️ ClickUp token or list ID not configured. Open Settings → Arch Visualizer.')
      return { board, ...result }
    }

    let tasks: CUTask[]
    try {
      tasks = await this.fetchTasks()
    } catch (e) {
      const msg = `ClickUp fetch error: ${e instanceof Error ? e.message : String(e)}`
      new Notice(`❌ ${msg}`)
      return { board, ...result, errors: [msg] }
    }

    try { await this.vault.createFolder('planning/briefs') } catch { }

    for (const cu of tasks) {
      const colName = this.mapStatus(cu.status.status, board.columns)
      const priority = this.mapPriority(cu.priority?.priority)
      const assignee = cu.assignees[0]?.username ? `@${cu.assignees[0].username}` : undefined
      const deadline = cu.due_date ? new Date(parseInt(cu.due_date)).toISOString().split('T')[0] : undefined

      const subtasks = cu.checklists.flatMap(cl =>
        cl.items.map(item => ({ text: item.name, done: item.resolved }))
      )

      // Full description from ClickUp (prefer markdown_description)
      const fullDesc = (cu.markdown_description || cu.description || '').trim()

      // Always write/update brief with full description
      if (fullDesc) {
        await this.writeBrief(cu.id, cu.name, fullDesc)
        result.briefs++
      }
      const briefRef = fullDesc ? `briefs/task-${cu.id}.md` : undefined

      // Short description for task card (first 200 chars, strip markdown)
      const shortDesc = fullDesc
        .replace(/#+\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n+/g, ' ')
        .slice(0, 200).trim()

      const existing = board.tasks.find(t => t.clickupId === cu.id)
      if (existing) {
        existing.title = cu.name
        existing.column = colName
        existing.description = shortDesc || existing.description
        existing.priority = priority
        if (assignee) existing.assignee = assignee
        if (deadline) existing.deadline = deadline
        if (subtasks.length) existing.subtasks = subtasks
        if (briefRef) existing.output = briefRef
        result.updated++
      } else {
        const newTask: TaskCard = {
          id: `cu-${cu.id}`,
          title: cu.name,
          description: shortDesc,
          column: colName,
          priority,
          assignee,
          deadline,
          subtasks,
          clickupId: cu.id,
          clickupListId: this.listId,
          output: briefRef,
        }
        board.tasks.push(newTask)
        result.added++
      }
    }

    return { board, ...result }
  }

  async pushTaskToClickUp(task: TaskCard): Promise<boolean> {
    if (!this.token || !task.clickupId) return false

    const statusName = LOCAL_TO_CU_STATUS[task.column.toLowerCase()] || 'to do'
    const priorityNum = LOCAL_TO_CU_PRIORITY[task.priority] ?? 3

    // Build description from brief file if available
    let description = task.description || ''
    if (task.output) {
      const briefFile = this.vault.getAbstractFileByPath(`planning/${task.output}`)
      if (briefFile instanceof TFile) {
        try {
          const content = await this.vault.read(briefFile)
          description = content
        } catch { /* keep card description */ }
      }
    }

    const body: Record<string, unknown> = {
      name: task.title,
      description,
      status: statusName,
      priority: priorityNum,
    }
    if (task.deadline) {
      body.due_date = new Date(task.deadline).getTime()
      body.due_date_time = false
    }
    if (task.assignee) {
      // Note: assignee push requires user ID, not username. Skip to avoid 400 errors.
    }

    try {
      const resp = await fetch(`https://api.clickup.com/api/v2/task/${task.clickupId}`, {
        method: 'PUT',
        headers: { Authorization: this.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return resp.ok
    } catch {
      return false
    }
  }

  private async fetchTasks(): Promise<CUTask[]> {
    const resp = await fetch(
      `https://api.clickup.com/api/v2/list/${this.listId}/task?include_closed=true&subtasks=true`,
      { headers: { Authorization: this.token } }
    )
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json() as { tasks: CUTask[] }
    return data.tasks || []
  }

  private async writeBrief(clickupId: string, title: string, description: string) {
    const briefPath = `planning/briefs/task-${clickupId}.md`
    const content = `# ${title}\n\n<!-- Synced from ClickUp: ${new Date().toISOString()} -->\n\n${description}\n`
    const existing = this.vault.getAbstractFileByPath(briefPath)
    if (existing instanceof TFile) {
      await this.vault.modify(existing, content)
    } else {
      try { await this.vault.create(briefPath, content) } catch { }
    }
  }

  private mapStatus(cuStatus: string, columns: string[]): string {
    const mapped = CU_STATUS_TO_LOCAL[cuStatus.toLowerCase()] || 'Todo'
    return columns.find(c => c.toLowerCase() === mapped.toLowerCase()) || columns[0] || 'Todo'
  }

  private mapPriority(cuPriority: string | undefined): 'high' | 'medium' | 'low' {
    if (!cuPriority) return 'medium'
    const p = cuPriority.toLowerCase()
    if (p === 'urgent' || p === 'high') return 'high'
    if (p === 'normal' || p === 'medium') return 'medium'
    return 'low'
  }
}
