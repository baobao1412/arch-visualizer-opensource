import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

interface ArchNodeData extends Record<string, unknown> {
  label: string;
  column: string;
  desc: string;
  highlighted?: boolean;
  dimmed?: boolean;
  activeColor?: string;
}

type ArchNodeType = Node<ArchNodeData, 'archNode'>;

function ArchNode({ data }: NodeProps<ArchNodeType>) {
  const d = data;

  const borderColor = d.highlighted ? (d.activeColor ?? '#f6c90e') : '#1e293b';
  const bgColor = d.highlighted ? 'rgba(246,201,14,0.06)' : '#0f1420';
  const opacity = d.dimmed ? 0.25 : 1;
  const shadow = d.highlighted
    ? `0 0 0 1px ${d.activeColor ?? '#f6c90e'}, 0 0 12px ${d.activeColor ?? '#f6c90e'}44`
    : 'none';

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: '8px 14px',
        minWidth: 160,
        maxWidth: 180,
        opacity,
        boxShadow: shadow,
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
        cursor: 'grab',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: borderColor }} />
      <div style={{ fontSize: 12, fontWeight: 600, color: d.highlighted ? (d.activeColor ?? '#f6c90e') : '#e2e8f0', lineHeight: 1.3 }}>
        {d.label}
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>
        {d.desc}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: borderColor }} />
    </div>
  );
}

export default memo(ArchNode);
