import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PlanningApp from './PlanningApp'
import './PlanningApp.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanningApp />
  </StrictMode>,
)
