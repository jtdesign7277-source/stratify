import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StratifyProvider from './store/StratifyProvider'
import { AuthProvider } from './context/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <StratifyProvider>
        <App />
      </StratifyProvider>
    </AuthProvider>
  </StrictMode>,
)
