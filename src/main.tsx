/**
 * Renderer entry. Mounts React in StrictMode. The HTML/body are transparent so
 * the glassmorphism widget floats with no opaque chrome behind it.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
