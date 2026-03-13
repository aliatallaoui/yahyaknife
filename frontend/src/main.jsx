import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initSentry } from './sentry'
import './index.css'
import './i18n' // Load translations before App renders
import App from './App.jsx'

initSentry(); // Activates only if VITE_SENTRY_DSN is set

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
