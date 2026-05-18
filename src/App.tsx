import { lazy, Suspense, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import FlowSidebar from './components/FlowSidebar'
import ArchDiagram from './components/ArchDiagram'
import MermaidMainCanvas from './components/MermaidMainCanvas'
import MermaidFlowSidebar from './components/MermaidFlowSidebar'
import { FLOWS } from './data/flows'
import type { MermaidBlock } from './utils/markdownMermaid'

const MarkdownDiagramPanel = lazy(() => import('./components/MarkdownDiagramPanel'))

export default function App() {
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState<boolean>(false)
  const [mainCanvasBlocks, setMainCanvasBlocks] = useState<MermaidBlock[]>([])
  const [activeMainCanvasBlockId, setActiveMainCanvasBlockId] = useState<string | null>(null)

  const activeFlow = useMemo(
    () => FLOWS.find((flow) => flow.id === activeFlowId) ?? null,
    [activeFlowId]
  )

  const inMainCanvasMode = mainCanvasBlocks.length > 0 && Boolean(activeMainCanvasBlockId)
  const activeMainCanvasBlock = useMemo(
    () => mainCanvasBlocks.find((block) => block.id === activeMainCanvasBlockId) ?? null,
    [activeMainCanvasBlockId, mainCanvasBlocks]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0a0a0f',
      }}
    >
      <header
        style={{
          minHeight: 48,
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          flexShrink: 0,
          background: '#0c0e18',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#e2e8f0',
            letterSpacing: '-0.3px',
          }}
        >
          arch-visualizer
        </span>
        <span style={{ fontSize: 11, color: '#334155' }}>-</span>
        <span style={{ fontSize: 11, color: '#475569' }}>
          {inMainCanvasMode ? 'Main Interactive Diagram' : 'Architecture and Flows'}
        </span>

        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: '#dbeafe',
            background: '#102744',
            border: '1px solid #1f4f80',
            borderRadius: 6,
            padding: '5px 10px',
            cursor: 'pointer',
          }}
        >
          README Mermaid Viewer
        </button>

        {inMainCanvasMode ? (
          <button
            type="button"
            onClick={() => {
              setMainCanvasBlocks([])
              setActiveMainCanvasBlockId(null)
            }}
            style={{
              fontSize: 11,
              color: '#fde68a',
              background: '#382a10',
              border: '1px solid #7c5d1e',
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            Back to architecture
          </button>
        ) : null}

        <span
          style={{
            fontSize: 10,
            color: '#1e3a5f',
            background: '#0d1f35',
            border: '1px solid #1e3a5f',
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          Smart Home IoT Platform
        </span>
      </header>

      {inMainCanvasMode ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <MermaidFlowSidebar
            blocks={mainCanvasBlocks}
            activeBlockId={activeMainCanvasBlockId}
            onSelect={setActiveMainCanvasBlockId}
          />
          <ReactFlowProvider key="main-flow-provider">
            {activeMainCanvasBlock ? <MermaidMainCanvas key={activeMainCanvasBlock.id} block={activeMainCanvasBlock} /> : null}
          </ReactFlowProvider>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <FlowSidebar flows={FLOWS} activeFlow={activeFlowId} onSelect={setActiveFlowId} />
          <ReactFlowProvider key="arch-flow-provider">
            <ArchDiagram activeFlowId={activeFlowId} />
          </ReactFlowProvider>
        </div>
      )}

      <Suspense fallback={null}>
        {panelOpen ? (
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
