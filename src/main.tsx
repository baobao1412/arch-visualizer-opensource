import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Support direct DOM injection by Obsidian plugin (sets __archVizContainer before script runs)
const _rootContainer =
  (window as Window & { __archVizContainer?: HTMLElement }).__archVizContainer ??
  document.getElementById('root')

createRoot(_rootContainer!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
