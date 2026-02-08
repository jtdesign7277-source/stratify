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
