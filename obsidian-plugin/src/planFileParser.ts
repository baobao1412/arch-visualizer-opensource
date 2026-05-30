import { PlanBoard, TaskCard, TaskComment, Subtask } from './types'

export function parsePlanFile(content: string): PlanBoard {
  const { frontmatter, body } = splitFrontmatter(content)
  const meta = parseFrontmatter(frontmatter)
  const title = meta.title || 'Untitled Plan'
  const columns = meta.columns || ['Todo', 'In Progress', 'Review', 'Done']
  const tasks = parseBody(body, columns)
  return { title, columns, tasks }
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { frontmatter: '', body: content }
  return { frontmatter: match[1], body: match[2] }
}

function parseFrontmatter(fm: string): { title?: string; columns?: string[] } {
  if (!fm.trim()) return {}
  const result: { title?: string; columns?: string[] } = {}
  const titleMatch = fm.match(/^title:\s*(.+)$/m)
  if (titleMatch) result.title = titleMatch[1].trim().replace(/^["']|["']$/g, '')
  const columnsMatch = fm.match(/^columns:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)/m)
  if (columnsMatch) {
    result.columns = columnsMatch[1]
      .split(/\r?\n/)
      .map((line: string) => line.replace(/^\s+-\s+/, '').trim())
      .filter(Boolean)
  }
  return result
}

function parseBody(body: string, columns: string[]): TaskCard[] {
  const tasks: TaskCard[] = []
  const columnSections = body.split(/^## /m).filter(Boolean)
  for (const section of columnSections) {
    const lines = section.split(/\r?\n/)
    const columnName = lines[0].trim()
    if (!columns.includes(columnName)) continue
    const taskBlocks = section.split(/^### /m).slice(1)
    for (const block of taskBlocks) {
      const task = parseTaskBlock(block, columnName)
      if (task) tasks.push(task)
    }
  }
  return tasks
}

function parseTaskBlock(block: string, column: string): TaskCard | null {
  const lines = block.split(/\r?\n/)
  if (!lines.length) return null
  const heading = lines[0].trim()
  const idMatch = heading.match(/^\[([^\]]+)\]\s+(.+)$/)
  if (!idMatch) return null
  const id = idMatch[1]
  const title = idMatch[2].trim()

  let milestone: string | undefined
  let deadline: string | undefined
  let assignee: string | undefined
  let depends: string[] | undefined
  let output: string | undefined
  let comments: TaskComment[] | undefined
  let clickupId: string | undefined
  let clickupListId: string | undefined
  let priority: 'high' | 'medium' | 'low' = 'medium'
  const subtasks: Subtask[] = []
  const descriptionLines: string[] = []
  let pastMetadata = false

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const subtaskMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)$/)
    if (subtaskMatch) {
      subtasks.push({ done: subtaskMatch[1].toLowerCase() === 'x', text: subtaskMatch[2].trim() })
      continue
    }
    const metaMatch = line.match(/^-\s+(milestone|deadline|priority|assignee|depends|output|comments|clickupId|clickupListId):\s*(.+)$/)
    if (metaMatch && !pastMetadata) {
      const [, key, value] = metaMatch
      switch (key) {
        case 'milestone': milestone = value.trim(); break
        case 'deadline': deadline = value.trim(); break
        case 'assignee': assignee = value.trim(); break
        case 'output': output = value.trim(); break
        case 'comments':
          try {
            comments = JSON.parse(value.trim())
          } catch {
            // Ignore malformed comment metadata and continue parsing task content.
          }
          break
        case 'depends': depends = value.split(',').map((v: string) => v.trim()).filter(Boolean); break
        case 'clickupId': clickupId = value.trim(); break
        case 'clickupListId': clickupListId = value.trim(); break
        case 'priority': {
          const p = value.trim().toLowerCase()
          if (p === 'high' || p === 'medium' || p === 'low') priority = p as 'high' | 'medium' | 'low'
          break
        }
      }
    } else if (line.trim() === '' && !pastMetadata && descriptionLines.length === 0) {
      pastMetadata = true
    } else {
      pastMetadata = true
      descriptionLines.push(line)
    }
  }

  return { id, title, description: descriptionLines.join('\n').trim(), milestone, deadline, priority, column, assignee, depends, subtasks, comments, output, clickupId, clickupListId }
}
