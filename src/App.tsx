import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import FlowSidebar from './components/FlowSidebar'
import ArchDiagram from './components/ArchDiagram'
import MermaidMainCanvas from './components/MermaidMainCanvas'
import MermaidFlowSidebar from './components/MermaidFlowSidebar'
import PlanningApp from './planning/PlanningApp'
import { FLOWS, type FlowDef } from './data/flows'
import type { MermaidBlock } from './utils/markdownMermaid'
import './App.css'

const MarkdownDiagramPanel = lazy(() => import('./components/MarkdownDiagramPanel'))

const APP_STATE_KEY = 'archviz.app.state.v1'

type AppPersistedState = {
  activeFlowId: string | null
  orderedFlowIds: string[]
  planningMode: boolean
}

function loadAppState(): AppPersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(APP_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppPersistedState
  } catch {
    return null
  }
}

function restoreOrderedFlows(ids: string[] | undefined) {
  if (!ids?.length) return FLOWS
  const byId = new Map(FLOWS.map((flow) => [flow.id, flow]))
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((flow): flow is FlowDef => Boolean(flow))
  const rest = FLOWS.filter((flow) => !ids.includes(flow.id))
  return [...ordered, ...rest]
}

export default function App() {
  const appState = useMemo(() => loadAppState(), [])
  const [orderedFlows, setOrderedFlows] = useState(() => restoreOrderedFlows(appState?.orderedFlowIds))
  const [activeFlowId, setActiveFlowId] = useState<string | null>(() => {
    if (!appState?.activeFlowId) return null
    return FLOWS.some((flow) => flow.id === appState.activeFlowId) ? appState.activeFlowId : null
  })
  const [panelOpen, setPanelOpen] = useState<boolean>(false)
  // Default to planning board when running inside Obsidian
  const [planningMode, setPlanningMode] = useState<boolean>(() => {
    if (typeof appState?.planningMode === 'boolean') return appState.planningMode
    return Boolean((window as Window & { __archVizBridge?: unknown }).__archVizBridge)
  })
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

  useEffect(() => {
    const state: AppPersistedState = {
      activeFlowId,
      orderedFlowIds: orderedFlows.map((flow) => flow.id),
      planningMode,
    }
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state))
  }, [activeFlowId, orderedFlows, planningMode])

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
