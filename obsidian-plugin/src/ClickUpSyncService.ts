import { Vault, TFile, requestUrl } from 'obsidian'
import { TaskCard, PlanBoard, TaskComment } from './types'

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
  list?: { id: string; name?: string }
  status: { status: string }
  due_date: string | null
  assignees: { username: string; email?: string }[]
  priority: { priority: string } | null
  checklists: { items: { name: string; resolved: boolean }[] }[]
  custom_fields?: { name: string; value: unknown }[]
}

interface CUTeam {
  id: string
  name?: string
}

interface CUComment {
  id: string
  comment_text: string
  user: { username: string }
  date: string
}

const SYNC_BLOCK_START = '<!-- ARCH_VISUALIZER_SYNC_BLOCK_START -->'
const SYNC_BLOCK_END = '<!-- ARCH_VISUALIZER_SYNC_BLOCK_END -->'

export interface SyncResult {
  added: number
  updated: number
  removed: number
  briefs: number
  errors: string[]
}

export interface PushAllResult {
  created: number
  updated: number
  failed: number
  commentsSynced: number
  errorSamples: string[]
}

export class ClickUpSyncService {
  private readonly authToken: string

  constructor(
    private token: string,
    private listId: string | undefined,
    private vault: Vault,
  ) {
    // Users sometimes paste token with spaces/quotes/newlines from settings dialogs.
    this.authToken = (token || '')
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .replace(/\s+/g, '')
  }

  async pullFromClickUp(board: PlanBoard): Promise<{ board: PlanBoard } & SyncResult> {
    const result: SyncResult = { added: 0, updated: 0, removed: 0, briefs: 0, errors: [] }

    if (!this.authToken) {
      return { board, ...result, errors: ['ClickUp token not configured.'] }
    }

    let tasks: CUTask[]
    try {
      tasks = await this.fetchTasks()
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      const authHint = raw.includes('OAUTH_019') || raw.includes('HTTP 401')
        ? 'ClickUp token invalid/expired. Open Settings and paste a valid Personal API Token (pk_...).'
        : raw
      const msg = `ClickUp fetch error: ${authHint}`
      return { board, ...result, errors: [msg] }
    }

    try { await this.vault.createFolder('planning/briefs') } catch { /* folder may already exist */ }

    const seenRemoteIds = new Set<string>()

    for (const cu of tasks) {
      seenRemoteIds.add(cu.id)
      const colName = this.mapStatus(cu.status.status, board.columns)
      const priority = this.mapPriority(cu.priority?.priority)
      const assignee = cu.assignees[0]?.username ? `@${cu.assignees[0].username}` : undefined
      const deadline = cu.due_date ? new Date(parseInt(cu.due_date)).toISOString().split('T')[0] : undefined

      const subtasks = cu.checklists.flatMap(cl =>
        cl.items.map(item => ({ text: item.name, done: item.resolved }))
      )

      // Full description from ClickUp (prefer markdown_description)
      const fullDesc = this.stripSyncBlock((cu.markdown_description || cu.description || '').trim())

      const remoteComments = await this.fetchComments(cu.id)
      const noteComments: TaskComment[] = remoteComments.map(comment => ({
        author: comment.user?.username || 'ClickUp',
        text: comment.comment_text || '',
        timestamp: new Date(parseInt(comment.date || '0') || Date.now()).toISOString(),
        type: 'note',
      }))

      // Always write/update brief with full description
      if (fullDesc) {
        await this.writeBrief(cu.id, cu.name, fullDesc)
        result.briefs++
      }
      const briefRef = fullDesc ? `briefs/task-${cu.id}.md` : undefined

      const cuListId = cu.list?.id || this.listId
      const existing = board.tasks.find(t => t.clickupId === cu.id)
        || board.tasks.find(t => !t.clickupId && this.normalizeTitle(t.title) === this.normalizeTitle(cu.name))
      if (existing) {
        existing.clickupId = cu.id
        if (cuListId) existing.clickupListId = cuListId
        existing.title = cu.name
        existing.column = colName
        existing.description = fullDesc || existing.description
        existing.priority = priority
        existing.assignee = assignee
        existing.deadline = deadline
        existing.subtasks = subtasks
        existing.output = briefRef
        existing.comments = this.mergeComments(existing.comments, noteComments)
        result.updated++
      } else {
        const newTask: TaskCard = {
          id: `cu-${cu.id}`,
          title: cu.name,
          description: fullDesc,
          column: colName,
          priority,
          assignee,
          deadline,
          subtasks,
          comments: noteComments,
          clickupId: cu.id,
          clickupListId: cuListId,
          output: briefRef,
        }
        board.tasks.push(newTask)
        result.added++
      }
    }

    // Full mirror mode for ClickUp-linked tasks.
    const before = board.tasks.length
    board.tasks = board.tasks.filter(task => {
      if (!task.clickupId) return true
      if (this.listId && task.clickupListId && task.clickupListId !== this.listId) return true
      return seenRemoteIds.has(task.clickupId)
    })
    result.removed = Math.max(0, before - board.tasks.length)

    return { board, ...result }
  }

  async inferListIdFromTask(taskId: string): Promise<string | undefined> {
    if (!this.authToken || !taskId) return undefined
    try {
      const resp = await this.requestJson<{ list?: { id?: string } }>(`/task/${taskId}`, 'GET')
      if (!(resp.status >= 200 && resp.status < 300)) return undefined
      return resp.data?.list?.id
    } catch {
      return undefined
    }
  }

  async pushTaskToClickUp(task: TaskCard): Promise<boolean> {
    if (!this.authToken || !task.clickupId) return false

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
      description: this.composeDescriptionForPush(task, description),
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
      const resp = await this.requestJson<unknown>(`/task/${task.clickupId}`, 'PUT', body)
      return resp.status >= 200 && resp.status < 300
    } catch {
      return false
    }
  }

  async pushAllTasksToClickUp(tasks: TaskCard[]): Promise<PushAllResult> {
    const result: PushAllResult = { created: 0, updated: 0, failed: 0, commentsSynced: 0, errorSamples: [] }
    if (!this.authToken) return result

    // Build lookup once so Sync Up can update by title even when task has no clickupId.
    const existingTasks = this.listId ? await this.fetchTasks().catch(() => []) : []
    const existingByTitle = new Map<string, string>()
    for (const cu of existingTasks) {
      const key = this.normalizeTitle(cu.name)
      if (!existingByTitle.has(key)) existingByTitle.set(key, cu.id)
    }

    for (const task of tasks) {
      const resolvedId = task.clickupId || existingByTitle.get(this.normalizeTitle(task.title))
      const pushed = await this.upsertTaskToClickUp(task, resolvedId)
      if (!pushed.ok) {
        result.failed++
        if (pushed.reason && result.errorSamples.length < 5) {
          result.errorSamples.push(`${task.title}: ${pushed.reason}`)
        }
        continue
      }
      if (pushed.created) result.created++
      else result.updated++
      if (pushed.clickupId) {
        task.clickupId = pushed.clickupId
        task.clickupListId = this.listId
        result.commentsSynced += await this.syncCommentsToClickUp(task, pushed.clickupId)
      }
    }
    return result
  }

  private async upsertTaskToClickUp(task: TaskCard, clickupId?: string): Promise<{ ok: boolean; created: boolean; clickupId?: string; reason?: string }> {
    if (!this.authToken) return { ok: false, created: false, reason: 'Missing ClickUp token' }

    const statusName = LOCAL_TO_CU_STATUS[task.column.toLowerCase()] || 'to do'
    const priorityNum = LOCAL_TO_CU_PRIORITY[task.priority] ?? 3
    const targetListId = this.listId || task.clickupListId

    // Build description from brief file if available
    let description = task.description || ''
    if (task.output) {
      const briefFile = this.vault.getAbstractFileByPath(`planning/${task.output}`)
      if (briefFile instanceof TFile) {
        try {
          description = await this.vault.read(briefFile)
        } catch {
          // Keep fallback description from task card.
        }
      }
    }

    const body: Record<string, unknown> = {
      name: task.title,
      description: this.composeDescriptionForPush(task, description),
      status: statusName,
      priority: priorityNum,
    }
    if (task.deadline) {
      body.due_date = new Date(task.deadline).getTime()
      body.due_date_time = false
    }

    try {
      if (clickupId) {
        try {
          const updateResp = await this.requestJson<unknown>(`/task/${clickupId}`, 'PUT', body)
          const ok = updateResp.status >= 200 && updateResp.status < 300
          return { ok, created: false, clickupId, reason: ok ? undefined : `HTTP ${updateResp.status}` }
        } catch (e) {
          const fallbackBody = { ...body }
          delete fallbackBody.status
          try {
            const fallbackResp = await this.requestJson<unknown>(`/task/${clickupId}`, 'PUT', fallbackBody)
            const ok = fallbackResp.status >= 200 && fallbackResp.status < 300
            return { ok, created: false, clickupId, reason: ok ? undefined : `HTTP ${fallbackResp.status}` }
          } catch (fallbackErr) {
            // Stale clickupId can happen when task was deleted/recreated remotely.
            if (targetListId) {
              try {
                const recreateResp = await this.requestJson<{ id?: string }>(`/list/${targetListId}/task`, 'POST', body)
                if (recreateResp.status >= 200 && recreateResp.status < 300 && recreateResp.data?.id) {
                  return { ok: true, created: true, clickupId: recreateResp.data.id }
                }
              } catch {
                // Preserve original errors below.
              }
            }
            const reason = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
            const primary = e instanceof Error ? e.message : String(e)
            return { ok: false, created: false, clickupId, reason: `${primary}; fallback(no-status): ${reason}` }
          }
        }
      }

      if (!targetListId) return { ok: false, created: false, reason: 'Missing ClickUp listId for create' }

      const createResp = await this.requestJson<{ id?: string }>(`/list/${targetListId}/task`, 'POST', body)
      if (!(createResp.status >= 200 && createResp.status < 300)) return { ok: false, created: true, reason: `HTTP ${createResp.status}` }
      const createdTask = createResp.data || {}
      if (!createdTask.id) return { ok: false, created: true, reason: 'Create response missing task id' }
      return { ok: true, created: true, clickupId: createdTask.id }
    } catch (e) {
      return { ok: false, created: !!clickupId, reason: e instanceof Error ? e.message : String(e) }
    }
  }

  private normalizeTitle(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  private async fetchTasks(): Promise<CUTask[]> {
    if (!this.listId) return this.fetchAllTasksAcrossTeams()

    const all: CUTask[] = []
    let page = 0
    while (true) {
      const resp = await this.requestJson<{ tasks?: CUTask[]; last_page?: boolean }>(
        `/list/${this.listId}/task?include_closed=true&subtasks=true&page=${page}`,
        'GET'
      )
      if (!(resp.status >= 200 && resp.status < 300)) throw new Error(`HTTP ${resp.status}`)
      const data = resp.data || {}
      const pageTasks = data.tasks || []
      all.push(...pageTasks)
      if (data.last_page || pageTasks.length === 0) break
      page++
      if (page > 1000) break
    }
    return all
  }

  private async fetchAllTasksAcrossTeams(): Promise<CUTask[]> {
    const teamsResp = await this.requestJson<{ teams?: CUTeam[] }>('/team', 'GET')
    if (!(teamsResp.status >= 200 && teamsResp.status < 300)) {
      throw new Error(`HTTP ${teamsResp.status}`)
    }

    const teams = teamsResp.data?.teams || []
    const all: CUTask[] = []
    for (const team of teams) {
      let page = 0
      while (true) {
        const resp = await this.requestJson<{ tasks?: CUTask[]; last_page?: boolean }>(
          `/team/${team.id}/task?include_closed=true&subtasks=true&page=${page}`,
          'GET'
        )
        if (!(resp.status >= 200 && resp.status < 300)) {
          throw new Error(`HTTP ${resp.status}`)
        }
        const data = resp.data || {}
        const pageTasks = data.tasks || []
        all.push(...pageTasks)
        if (data.last_page || pageTasks.length === 0) break
        page++
        if (page > 1000) break
      }
    }
    return all
  }

  private async fetchComments(taskId: string): Promise<CUComment[]> {
    try {
      const resp = await this.requestJson<{ comments?: CUComment[] }>(`/task/${taskId}/comment`, 'GET')
      return resp.data?.comments || []
    } catch {
      return []
    }
  }

  private async syncCommentsToClickUp(task: TaskCard, clickupId: string): Promise<number> {
    const local = task.comments || []
    if (!local.length) return 0

    const remote = await this.fetchComments(clickupId)
    const remoteTexts = new Set(remote.map(c => (c.comment_text || '').trim()))

    let pushed = 0
    for (const c of local) {
      const commentText = this.formatCommentForPush(c)
      if (!commentText || remoteTexts.has(commentText)) continue
      try {
        await this.requestJson<unknown>(`/task/${clickupId}/comment`, 'POST', {
          comment_text: commentText,
          notify_all: false,
        })
        pushed++
      } catch {
        // Keep push resilient even if individual comment sync fails.
      }
    }
    return pushed
  }

  private formatCommentForPush(comment: TaskComment): string {
    const body = (comment.text || '').trim()
    if (!body) return ''
    const author = (comment.author || 'Unknown').trim()
    const type = (comment.type || 'note').toUpperCase()
    const ts = comment.timestamp ? new Date(comment.timestamp).toISOString() : new Date().toISOString()
    return `[${type}] ${author} @ ${ts}\n${body}`
  }

  private composeDescriptionForPush(task: TaskCard, baseDescription: string): string {
    const cleanBase = this.stripSyncBlock((baseDescription || '').trim())
    const lines: string[] = []
    lines.push(SYNC_BLOCK_START)
    lines.push(`taskId: ${task.id}`)
    lines.push(`column: ${task.column}`)
    lines.push(`priority: ${task.priority}`)
    lines.push(`assignee: ${task.assignee || ''}`)
    lines.push(`deadline: ${task.deadline || ''}`)
    lines.push(`output: ${task.output || ''}`)
    lines.push(`depends: ${(task.depends || []).join(', ')}`)
    lines.push('subtasks:')
    for (const s of task.subtasks || []) lines.push(`- [${s.done ? 'x' : ' '}] ${s.text}`)
    lines.push(SYNC_BLOCK_END)
    return `${cleanBase}\n\n${lines.join('\n')}`.trim()
  }

  private stripSyncBlock(text: string): string {
    if (!text) return ''
    const start = text.indexOf(SYNC_BLOCK_START)
    if (start === -1) return text.trim()
    const end = text.indexOf(SYNC_BLOCK_END, start)
    if (end === -1) return text.slice(0, start).trim()
    return `${text.slice(0, start)}${text.slice(end + SYNC_BLOCK_END.length)}`.trim()
  }

  private mergeComments(existing: TaskComment[] | undefined, incomingNotes: TaskComment[]): TaskComment[] {
    const keepLocal = (existing || []).filter(c => c.type === 'review' || c.type === 'rework')
    const unique = new Map<string, TaskComment>()
    for (const c of incomingNotes) {
      const key = `${c.author}|${c.timestamp}|${c.text}`
      unique.set(key, c)
    }
    return [...keepLocal, ...Array.from(unique.values())]
  }

  private async requestJson<T>(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<{ status: number; data?: T }> {
    const doRequest = async (authorization: string) => {
      const response = await requestUrl({
        url: `https://api.clickup.com/api/v2${path}`,
        method,
        headers: {
          Authorization: authorization,
          authorization,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        throw: false,
      })

      let data: T | undefined
      try {
        data = response.json as T
      } catch {
        data = undefined
      }
      return { status: response.status, text: response.text || '', data }
    }

    // Try multiple auth formats used by ClickUp tokens across versions/installations.
    const authCandidates: string[] = []
    const pushCandidate = (v: string) => { if (v && !authCandidates.includes(v)) authCandidates.push(v) }
    pushCandidate(this.authToken)
    if (!this.authToken.toLowerCase().startsWith('bearer ')) pushCandidate(`Bearer ${this.authToken}`)
    if (!this.authToken.toLowerCase().startsWith('token ')) pushCandidate(`Token ${this.authToken}`)

    let result = { status: 401, text: '', data: undefined as T | undefined }
    for (const candidate of authCandidates) {
      result = await doRequest(candidate)
      if (result.status >= 200 && result.status < 300) break
      if (result.status !== 401) break
    }

    if (!(result.status >= 200 && result.status < 300)) {
      const message = result.text.trim()
      throw new Error(`HTTP ${result.status}${message ? ` - ${message}` : ''}`)
    }
    return { status: result.status, data: result.data }
  }

  private async writeBrief(clickupId: string, title: string, description: string) {
    const briefPath = `planning/briefs/task-${clickupId}.md`
    const content = `# ${title}\n\n<!-- Synced from ClickUp: ${new Date().toISOString()} -->\n\n${description}\n`
    const existing = this.vault.getAbstractFileByPath(briefPath)
    if (existing instanceof TFile) {
      await this.vault.modify(existing, content)
    } else {
      try { await this.vault.create(briefPath, content) } catch { /* file may already exist */ }
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
