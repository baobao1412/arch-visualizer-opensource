import type { FlowDef } from '../data/flows';
import { BASE_NODES } from '../data/flows';

interface Props {
  flow: FlowDef | null;
}

export default function FlowDetail({ flow }: Props) {
  if (!flow) return null;

  const stepNodes = flow.steps
    .map((id) => BASE_NODES.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 280,
        background: '#0c0e18',
        border: `1px solid ${flow.color}44`,
        borderRadius: 10,
        padding: '16px',
        boxShadow: `0 0 24px ${flow.color}22`,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: flow.color,
            flexShrink: 0,
            boxShadow: `0 0 6px ${flow.color}`,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: flow.color }}>
          {flow.label}
        </span>
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 12px' }}>
        {flow.description}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {stepNodes.map((node, i) => (
          <span key={node!.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 10,
                color: flow.color,
                background: `${flow.color}15`,
                border: `1px solid ${flow.color}44`,
                borderRadius: 4,
                padding: '2px 6px',
              }}
            >
              {(node!.data as { label: string }).label}
            </span>
            {i < stepNodes.length - 1 && (
              <span style={{ color: '#334155', fontSize: 10 }}>{'->'}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
