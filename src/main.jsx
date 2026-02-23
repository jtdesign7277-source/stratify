import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import StratifyProvider from './store/StratifyProvider'

const CHUNK_RELOAD_KEY = 'stratify-chunk-reload-attempted'

const toErrorMessage = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value?.message === 'string') return value.message
  return String(value)
}

const isChunkLoadError = (value) => {
  const message = toErrorMessage(value).toLowerCase()
  if (!message) return false
  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('chunkloaderror')
    || message.includes('loading chunk')
  )
}

const reloadForChunkError = (value) => {
  if (!isChunkLoadError(value)) return false

  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return false
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  } catch {
    // Ignore storage access issues in restrictive contexts.
  }

  console.warn('[App] Chunk load error detected. Reloading once to recover latest deploy.')
  window.location.reload()
  return true
}

window.addEventListener('load', () => {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
  } catch {
    // Ignore storage access issues in restrictive contexts.
  }
})

window.addEventListener('vite:preloadError', (event) => {
  if (reloadForChunkError(event?.payload)) {
    event.preventDefault?.()
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if (reloadForChunkError(event?.reason)) {
    event.preventDefault?.()
  }
})

window.addEventListener('error', (event) => {
  reloadForChunkError(event?.error || event?.message)
})

Sentry.init({
  dsn: 'https://33b0952ac3a4edcd34f2741854287569@o4510744882642944.ingest.us.sentry.io/4510920320811008',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filter chunk-load noise from Sentry because the app auto-recovers.
    const errorMessage = toErrorMessage(hint?.originalException || event?.exception?.values?.[0]?.value)
    if (isChunkLoadError(errorMessage)) {
      return null
    }
    return event
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StratifyProvider>
      <App />
    </StratifyProvider>
  </StrictMode>,
)
