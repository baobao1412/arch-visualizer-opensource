import type { Edge, Node } from '@xyflow/react'
import type { CSSProperties } from 'react'

export interface MermaidFlowEdgeData {
  lineNumber: number
  lineText: string
}

export interface MermaidFlowGraph {
  kind: 'sequence' | 'class' | 'other'
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
  const firstLine = lines.find((line) => line.trim().length > 0)?.trim() ?? ''

  if (firstLine.startsWith('sequenceDiagram')) {
    return parseSequenceDiagram(lines)
  }

  if (firstLine.startsWith('classDiagram')) {
    return parseClassDiagram(lines)
  }

  return {
    kind: 'other',
    nodes: [],
    edges: [],
    notes: ['Only sequenceDiagram and classDiagram can be opened in main interactive canvas.'],
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

    const relationMatch = /^([A-Za-z0-9_]+)\s*([*o.<|\\/-]+)\s*([A-Za-z0-9_]+)(?:\s*:\s*(.+))?$/.exec(line)
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
