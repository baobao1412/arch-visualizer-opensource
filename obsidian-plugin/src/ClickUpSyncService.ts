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

interface CUTask {
  id: string
  name: string
  description: string
  status: { status: string }
  due_date: string | null
  assignees: { username: string }[]
  priority: { priority: string } | null
  checklists: { items: { name: string; resolved: boolean }[] }[]
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

      // Write brief if description is substantial
      let outputRef: string | undefined
      if (cu.description?.trim().length > 200) {
        await this.writeBrief(cu.id, cu.name, cu.description)
        outputRef = `briefs/task-${cu.id}.md`
        result.briefs++
      }

      const existing = board.tasks.find(t => t.clickupId === cu.id)
      if (existing) {
        // Update remote fields, preserve local comments and brief edits
        existing.column = colName
        if (assignee) existing.assignee = assignee
        if (deadline) existing.deadline = deadline
        existing.priority = priority
        if (subtasks.length) existing.subtasks = subtasks
        if (outputRef && !existing.output) existing.output = outputRef
        result.updated++
      } else {
        const newTask: TaskCard = {
          id: `cu-${cu.id}`,
          title: cu.name,
          description: cu.description?.slice(0, 300).replace(/\n+/g, ' ').trim() || '',
          column: colName,
          priority,
          assignee,
          deadline,
          subtasks,
          clickupId: cu.id,
          clickupListId: this.listId,
          output: outputRef,
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
    try {
      const resp = await fetch(`https://api.clickup.com/api/v2/task/${task.clickupId}`, {
        method: 'PUT',
        headers: { Authorization: this.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusName }),
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
    const existing = this.vault.getAbstractFileByPath(briefPath)
    if (existing instanceof TFile) return  // Don't overwrite edited briefs
    const content = `# ${title}\n\n<!-- Imported from ClickUp -->\n\n${description}\n`
    try { await this.vault.create(briefPath, content) } catch { }
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
