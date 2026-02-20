import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import StratifyProvider from './store/StratifyProvider'

Sentry.init({
  dsn: 'https://33b0952ac3a4edcd34f2741854287569@o4510744882642944.ingest.us.sentry.io/4510920320811008',
  sendDefaultPii: true,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StratifyProvider>
      <App />
    </StratifyProvider>
  </StrictMode>,
)
