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
  const color = d.activeColor ?? '#38bdf8';

  const bg = d.highlighted
    ? `linear-gradient(135deg, ${color}14 0%, rgba(15,20,40,0.72) 100%)`
    : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(10,15,28,0.65) 100%)';

  const border = d.highlighted
    ? `1px solid ${color}88`
    : '1px solid rgba(255,255,255,0.07)';

  const shadow = d.highlighted
    ? `0 0 0 1px ${color}44, 0 0 18px ${color}33, 0 4px 24px rgba(0,0,0,0.5)`
    : '0 2px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)';

  const opacity = d.dimmed ? 0.18 : 1;

  return (
    <div
      style={{
        background: bg,
        border,
        borderRadius: 10,
        padding: '9px 14px',
        minWidth: 160,
        maxWidth: 185,
        opacity,
        boxShadow: shadow,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        transition: 'all 0.22s ease',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glass shimmer top edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: d.highlighted
          ? `linear-gradient(90deg, transparent, ${color}55, transparent)`
          : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
      }} />

      <Handle type="target" position={Position.Left} style={{
        background: d.highlighted ? color : 'rgba(255,255,255,0.15)',
        border: `1px solid ${d.highlighted ? color : 'rgba(255,255,255,0.1)'}`,
        width: 8, height: 8,
      }} />

      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: d.highlighted ? color : '#cbd5e1',
        lineHeight: 1.3,
        marginBottom: 4,
        textShadow: d.highlighted ? `0 0 12px ${color}66` : 'none',
      }}>
        {d.label}
      </div>

      <div style={{
        fontSize: 10,
        color: d.highlighted ? `${color}bb` : 'rgba(148,163,184,0.7)',
        lineHeight: 1.45,
      }}>
        {d.desc}
      </div>

      <Handle type="source" position={Position.Right} style={{
        background: d.highlighted ? color : 'rgba(255,255,255,0.15)',
        border: `1px solid ${d.highlighted ? color : 'rgba(255,255,255,0.1)'}`,
        width: 8, height: 8,
      }} />
    </div>
  );
}

export default memo(ArchNode);
