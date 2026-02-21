import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StratifyProvider from './store/StratifyProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StratifyProvider>
      <App />
    </StratifyProvider>
  </StrictMode>,
)
// Fri Feb 20 22:38:19 EST 2026
// redeploy 1771645213
