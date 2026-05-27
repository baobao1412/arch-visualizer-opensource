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
      className="flow-detail"
      style={{
        border: `1px solid ${flow.color}44`,
        boxShadow: `0 0 24px ${flow.color}22`,
        '--flow-color': flow.color,
        '--flow-color-bg': `${flow.color}15`,
        '--flow-color-border': `${flow.color}44`,
      } as React.CSSProperties}
    >
      <div className="flow-detail-header">
        <span
          className="flow-detail-dot"
          style={{ background: flow.color, boxShadow: `0 0 6px ${flow.color}` }}
        />
        <span className="flow-detail-label" style={{ color: flow.color }}>
          {flow.label}
        </span>
      </div>

      <p className="flow-detail-desc">{flow.description}</p>

      <div className="flow-detail-steps">
        {stepNodes.map((node, i) => (
          <span key={node!.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              className="flow-detail-step"
              style={{
                color: flow.color,
                background: `var(--flow-color-bg)`,
                border: `1px solid var(--flow-color-border)`,
              }}
            >
              {(node!.data as { label: string }).label}
            </span>
            {i < stepNodes.length - 1 && (
              <span className="flow-detail-arrow">→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
