import type { Edge, Node } from '@xyflow/react'
import type { CSSProperties } from 'react'

export interface MermaidFlowEdgeData {
  lineNumber: number
  lineText: string
}

export interface MermaidFlowGraph {
  kind: 'sequence' | 'class' | 'flowchart' | 'other'
  nodes: Node[]
  edges: Edge[]
  notes: string[]
}

interface SequenceParticipant {
  id: string
  label: string
}

interface SequenceMessage {
  id: string
  source: string
  target: string
  label: string
  lineNumber: number
  lineText: string
}

interface ClassRelation {
  id: string
  source: string
  target: string
  label: string
  lineNumber: number
  lineText: string
}

export function parseMermaidToFlow(code: string): MermaidFlowGraph {
  const lines = code.split('\n')
  const firstDirective = lines
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('%%')) ?? ''

  if (firstDirective.startsWith('sequenceDiagram')) {
    return parseSequenceDiagram(lines)
  }

  if (firstDirective.startsWith('classDiagram')) {
    return parseClassDiagram(lines)
  }

  if (firstDirective.startsWith('flowchart') || firstDirective.startsWith('graph ')) {
    return parseFlowchartDiagram(lines)
  }

  return {
    kind: 'other',
    nodes: [],
    edges: [],
    notes: ['Unsupported Mermaid syntax for interactive mode. Use sequenceDiagram, classDiagram, flowchart, or graph.'],
  }
}

function parseFlowchartDiagram(lines: string[]): MermaidFlowGraph {
  const nodeLabelById = new Map<string, string>()
  const edgeRows: Array<{ source: string; target: string; label: string; lineNumber: number; lineText: string }> = []

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (!line || line.startsWith('flowchart') || line.startsWith('graph ') || line.startsWith('subgraph') || line === 'end') {
      continue
    }

    const edgeMatch = /^([A-Za-z0-9_]+)(?:\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?\s*[-.]+>\s*(?:\|([^|]+)\|\s*)?([A-Za-z0-9_]+)(?:\[[^\]]+\]|\([^)]+\)|\{[^}]+\})?/.exec(line)
    if (edgeMatch) {
      const sourceId = edgeMatch[1]
      const targetId = edgeMatch[3]
      const label = (edgeMatch[2] ?? '').trim()

      edgeRows.push({
        source: sourceId,
        target: targetId,
        label,
        lineNumber: i + 1,
        lineText: rawLine,
      })
      continue
    }

    const nodeDeclRegex = /([A-Za-z0-9_]+)\s*(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})/g
    let nodeMatch: RegExpExecArray | null = nodeDeclRegex.exec(line)
    while (nodeMatch) {
      const id = nodeMatch[1]
      const label = (nodeMatch[2] ?? nodeMatch[3] ?? nodeMatch[4] ?? id).trim()
      if (!nodeLabelById.has(id)) {
        nodeLabelById.set(id, label)
      }
      nodeMatch = nodeDeclRegex.exec(line)
    }
  }

  for (const edge of edgeRows) {
    if (!nodeLabelById.has(edge.source)) {
      nodeLabelById.set(edge.source, edge.source)
    }
    if (!nodeLabelById.has(edge.target)) {
      nodeLabelById.set(edge.target, edge.target)
    }
  }

  const nodeIds = Array.from(nodeLabelById.keys())
  const nodes: Node[] = nodeIds.map((id, index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    return {
      id,
      position: { x: 80 + col * 260, y: 100 + row * 150 },
      data: { label: nodeLabelById.get(id) ?? id },
      style: defaultNodeStyle(),
    }
  })

  const edges: Edge[] = edgeRows.map((edge, index) => ({
    id: `flow-edge-${index + 1}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: {
      lineNumber: edge.lineNumber,
      lineText: edge.lineText,
    } satisfies MermaidFlowEdgeData,
  }))

  return {
    kind: 'flowchart',
    nodes,
    edges,
    notes: [],
  }
}

function parseSequenceDiagram(lines: string[]): MermaidFlowGraph {
  const participants: SequenceParticipant[] = []
  const participantById = new Map<string, SequenceParticipant>()
  const messages: SequenceMessage[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (!line || line.startsWith('sequenceDiagram')) {
      continue
    }

    const participantMatch = /^participant\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$/i.exec(line)
    if (participantMatch) {
      const id = participantMatch[1]
      const label = (participantMatch[2] ?? id).trim()
      if (!participantById.has(id)) {
        const participant = { id, label }
        participants.push(participant)
        participantById.set(id, participant)
      }
      continue
    }

    const messageMatch = /^([A-Za-z0-9_]+)\s*[-.<]+[->>]+\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/i.exec(line)
    if (messageMatch) {
      const source = messageMatch[1]
      const target = messageMatch[2]
      const label = messageMatch[3].trim()

      if (!participantById.has(source)) {
        const sourceParticipant = { id: source, label: source }
        participants.push(sourceParticipant)
        participantById.set(source, sourceParticipant)
      }

      if (!participantById.has(target)) {
        const targetParticipant = { id: target, label: target }
        participants.push(targetParticipant)
        participantById.set(target, targetParticipant)
      }

      messages.push({
        id: `seq-edge-${messages.length + 1}`,
        source,
        target,
        label,
        lineNumber: i + 1,
        lineText: rawLine,
      })
    }
  }

  const nodes: Node[] = participants.map((participant, index) => ({
    id: participant.id,
    position: { x: 80 + index * 240, y: 120 },
    data: { label: participant.label },
    style: defaultNodeStyle(),
  }))

  const edges: Edge[] = messages.map((message, index) => ({
    id: message.id,
    source: message.source,
    target: message.target,
    label: `${index + 1}. ${message.label}`,
    data: {
      lineNumber: message.lineNumber,
      lineText: message.lineText,
    } satisfies MermaidFlowEdgeData,
  }))

  return {
    kind: 'sequence',
    nodes,
    edges,
    notes: [],
  }
}

function parseClassDiagram(lines: string[]): MermaidFlowGraph {
  const classSet = new Set<string>()
  const relations: ClassRelation[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (!line || line.startsWith('classDiagram')) {
      continue
    }

    const classMatch = /^class\s+([A-Za-z0-9_]+)/.exec(line)
    if (classMatch) {
      classSet.add(classMatch[1])
    }

    const relationMatch = /^([A-Za-z0-9_]+)\s*([*o.<>|\\/-]+)\s*([A-Za-z0-9_]+)(?:\s*:\s*(.+))?$/.exec(line)
    if (relationMatch) {
      const source = relationMatch[1]
      const target = relationMatch[3]
      const label = (relationMatch[4] ?? relationMatch[2]).trim()
      classSet.add(source)
      classSet.add(target)
      relations.push({
        id: `cls-edge-${relations.length + 1}`,
        source,
        target,
        label,
        lineNumber: i + 1,
        lineText: rawLine,
      })
    }
  }

  const classNames = Array.from(classSet)
  const nodes: Node[] = classNames.map((name, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    return {
      id: name,
      position: { x: 80 + col * 320, y: 120 + row * 180 },
      data: { label: name },
      style: defaultNodeStyle(),
    }
  })

  const edges: Edge[] = relations.map((relation) => ({
    id: relation.id,
    source: relation.source,
    target: relation.target,
    label: relation.label,
    data: {
      lineNumber: relation.lineNumber,
      lineText: relation.lineText,
    } satisfies MermaidFlowEdgeData,
  }))

  return {
    kind: 'class',
    nodes,
    edges,
    notes: [],
  }
}

function defaultNodeStyle(): CSSProperties {
  return {
    border: '1px solid #334155',
    borderRadius: 10,
    background: '#111827',
    color: '#e5e7eb',
    padding: 8,
    minWidth: 180,
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(2, 6, 23, 0.45)',
  }
}
