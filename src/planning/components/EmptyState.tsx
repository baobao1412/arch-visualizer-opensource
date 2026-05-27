interface EmptyStateProps {
  onOpenFile: () => void
  onCreateFile: () => void
  isVscode: boolean
}

export function EmptyState({ onOpenFile, onCreateFile, isVscode }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
      <p className="empty-title">No Planning Board</p>
      <p className="empty-desc">
        {isVscode ? 'Create or open a .plan.md file to get started' : 'Create a local planning board to get started'}
      </p>
      <div className="empty-actions">
        <button type="button" className="btn-primary" onClick={onCreateFile}>
          Create New Plan
        </button>
        {isVscode ? (
          <button type="button" className="btn-secondary" onClick={onOpenFile}>
            Open Existing
          </button>
        ) : null}
      </div>
    </div>
  )
}
