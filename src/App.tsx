import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import FlowSidebar from './components/FlowSidebar'
import ArchDiagram from './components/ArchDiagram'
import MermaidMainCanvas from './components/MermaidMainCanvas'
import MermaidFlowSidebar from './components/MermaidFlowSidebar'
import PlanningApp from './planning/PlanningApp'
import { FLOWS } from './data/flows'
import type { MermaidBlock } from './utils/markdownMermaid'
import './App.css'

const MarkdownDiagramPanel = lazy(() => import('./components/MarkdownDiagramPanel'))

export default function App() {
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)
  const [orderedFlows, setOrderedFlows] = useState(FLOWS)
  const [panelOpen, setPanelOpen] = useState<boolean>(false)
  const [planningMode, setPlanningMode] = useState<boolean>(false)
  const [mainCanvasBlocks, setMainCanvasBlocks] = useState<MermaidBlock[]>([])
  const [activeMainCanvasBlockId, setActiveMainCanvasBlockId] = useState<string | null>(null)

  const activeFlow = useMemo(
    () => orderedFlows.find((flow) => flow.id === activeFlowId) ?? null,
    [activeFlowId, orderedFlows]
  )

  const inMainCanvasMode = mainCanvasBlocks.length > 0 && Boolean(activeMainCanvasBlockId)
  const activeMainCanvasBlock = useMemo(
    () => mainCanvasBlocks.find((block) => block.id === activeMainCanvasBlockId) ?? null,
    [activeMainCanvasBlockId, mainCanvasBlocks]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !planningMode && !panelOpen) {
        setActiveFlowId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [planningMode, panelOpen])

  const modeLabel = planningMode
    ? 'Planning Board'
    : inMainCanvasMode
      ? 'Main Interactive Diagram'
      : 'Architecture and Flows'

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-header-title">arch-visualizer</span>
        <span className="app-header-sep">-</span>
        <span className="app-header-mode">{modeLabel}</span>

        <button
          type="button"
          className={`app-btn app-btn-ml ${planningMode ? 'app-btn-amber' : 'app-btn-blue'}`}
          onClick={() => setPlanningMode((prev) => !prev)}
        >
          {planningMode ? 'Back to diagrams' : 'Planning Board'}
        </button>

        {!planningMode ? (
          <button
            type="button"
            className="app-btn app-btn-blue app-btn-right"
            onClick={() => setPanelOpen(true)}
          >
            README Mermaid Viewer
          </button>
        ) : (
          <span className="app-btn-right" />
        )}

        {inMainCanvasMode && !planningMode ? (
          <button
            type="button"
            className="app-btn app-btn-yellow"
            onClick={() => {
              setMainCanvasBlocks([])
              setActiveMainCanvasBlockId(null)
            }}
          >
            Back to architecture
          </button>
        ) : null}

        <span className="app-header-badge">Smart Home IoT Platform</span>
      </header>

      {planningMode ? (
        <PlanningApp />
      ) : inMainCanvasMode ? (
        <div className="app-content">
          <MermaidFlowSidebar
            blocks={mainCanvasBlocks}
            activeBlockId={activeMainCanvasBlockId}
            onSelect={setActiveMainCanvasBlockId}
            onReorder={setMainCanvasBlocks}
          />
          <ReactFlowProvider key="main-flow-provider">
            {activeMainCanvasBlock ? <MermaidMainCanvas key={activeMainCanvasBlock.id} block={activeMainCanvasBlock} /> : null}
          </ReactFlowProvider>
        </div>
      ) : (
        <div className="app-content">
          <FlowSidebar flows={orderedFlows} activeFlow={activeFlowId} onSelect={setActiveFlowId} onReorder={setOrderedFlows} />
          <ReactFlowProvider key="arch-flow-provider">
            <ArchDiagram activeFlowId={activeFlowId} />
          </ReactFlowProvider>
        </div>
      )}

      <Suspense fallback={null}>
        {panelOpen && !planningMode ? (
          <MarkdownDiagramPanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            activeFlow={activeFlow}
            onOpenInMainCanvas={(blocks, selectedBlockId) => {
              setMainCanvasBlocks(blocks)
              setActiveMainCanvasBlockId(selectedBlockId)
              setPanelOpen(false)
            }}
          />
        ) : null}
      </Suspense>
    </div>
  )
}
