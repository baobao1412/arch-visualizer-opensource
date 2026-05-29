import { PlanBoard, TaskCard } from './types'

export function serializePlanFile(board: PlanBoard): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`title: ${quoteYaml(board.title)}`)
  lines.push('columns:')
  for (const col of board.columns) lines.push(`  - ${quoteYaml(col)}`)
  lines.push('---')
  lines.push('')

  for (const column of board.columns) {
    const columnTasks = board.tasks.filter(t => t.column === column)
    lines.push(`## ${column}`)
    lines.push('')
    for (const task of columnTasks) {
      lines.push(`### [${task.id}] ${task.title}`)
      if (task.assignee) lines.push(`- assignee: ${task.assignee}`)
      if (task.milestone) lines.push(`- milestone: ${task.milestone}`)
      if (task.deadline) lines.push(`- deadline: ${task.deadline}`)
      lines.push(`- priority: ${task.priority}`)
      if (task.depends?.length) lines.push(`- depends: ${task.depends.join(', ')}`)
      if (task.output) lines.push(`- output: ${task.output}`)
      if (task.clickupId) lines.push(`- clickupId: ${task.clickupId}`)
      if (task.clickupListId) lines.push(`- clickupListId: ${task.clickupListId}`)
      if (task.comments?.length) lines.push(`- comments: ${JSON.stringify(task.comments)}`)
      lines.push('')
      if (task.description) { lines.push(task.description); lines.push('') }
      if (task.subtasks?.length) {
        for (const sub of task.subtasks) lines.push(`- [${sub.done ? 'x' : ' '}] ${sub.text}`)
        lines.push('')
      }
    }
  }
  return lines.join('\n')
}

function quoteYaml(value: string): string {
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.startsWith("'") || value.startsWith('"')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

export function generateTaskId(existingTasks: TaskCard[]): string {
  let maxNum = 0
  for (const task of existingTasks) {
    const match = task.id.match(/^task-(\d+)$/)
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10))
  }
  return `task-${maxNum + 1}`
}
