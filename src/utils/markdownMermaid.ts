import type { FlowDef } from '../data/flows'

export interface MermaidBlock {
  id: string
  title: string
  type: 'sequence' | 'class' | 'other'
  code: string
}

export function parseMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = []
  const regex = /```mermaid\s*([\s\S]*?)```/gi
  let match: RegExpExecArray | null = regex.exec(markdown)
  let index = 1

  while (match) {
    const code = match[1].trim()
    if (code.length > 0) {
      const firstLine = code.split('\n').find((line) => line.trim().length > 0)?.trim() ?? ''
      let type: MermaidBlock['type'] = 'other'
      if (firstLine.startsWith('sequenceDiagram')) {
        type = 'sequence'
      } else if (firstLine.startsWith('classDiagram')) {
        type = 'class'
      }

      blocks.push({
        id: `mermaid-${index}`,
        title: `${type.toUpperCase()} #${index}`,
        type,
        code,
      })
      index += 1
    }

    match = regex.exec(markdown)
  }

  return blocks
}

export function buildFlowMarkdown(flow: FlowDef | null): string {
  const title = flow?.label ?? 'Architecture Flow'
  const steps = flow?.steps ?? ['client', 'api', 'db']
  const actor = steps[0] ?? 'client'

  const sequenceLines = [
    'sequenceDiagram',
    `participant A as ${sanitizeLabel(actor)}`,
    `participant B as ${sanitizeLabel(steps[1] ?? 'service')}`,
    `participant C as ${sanitizeLabel(steps[2] ?? 'storage')}`,
    'A->>B: request',
    'B->>C: process and persist',
    'C-->>B: done',
    'B-->>A: response',
  ]

  const classLines = [
    'classDiagram',
    'class FlowContext {',
    '  +string id',
    '  +string label',
    '  +execute() void',
    '}',
    'class FlowEngine {',
    '  +run(context) void',
    '  +validate(context) bool',
    '}',
    'class StepStore {',
    '  +save(step) void',
    '}',
    'FlowEngine --> FlowContext : uses',
    'FlowEngine --> StepStore : persists',
  ]

  return `# ${title}\n\nPaste your README content here and keep Mermaid blocks in this format:\n\n\`\`\`mermaid\n${sequenceLines.join('\n')}\n\`\`\`\n\n\`\`\`mermaid\n${classLines.join('\n')}\n\`\`\`\n`
}

function sanitizeLabel(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_\- ]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
}
