import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import './index.css'
import App from './App.jsx'
import StratifyProvider from './store/StratifyProvider'

// Auto-reload on chunk load errors (stale builds after deploy)
window.addEventListener('error', (event) => {
  if (event.message?.includes('dynamically imported module') || 
      event.message?.includes('Failed to fetch')) {
    console.warn('Chunk load error detected - reloading page');
    window.location.reload();
  }
});

Sentry.init({
  dsn: "https://33b0952ac3a4edcd34f2741854287569@o4510744882642944.ingest.us.sentry.io/4510920320811008",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filter out chunk load errors from Sentry (they auto-reload)
    const error = hint?.originalException;
    if (error?.message?.includes('dynamically imported module') || 
        error?.message?.includes('Failed to fetch')) {
      return null; // Don't send to Sentry
    }
    return event;
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StratifyProvider>
      <App />
    </StratifyProvider>
  </StrictMode>,
)
