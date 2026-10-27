import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initAnalytics } from './lib/analytics'
import { initMonitoring, Sentry } from './lib/monitoring'
import { initNative } from './lib/native'

initMonitoring()
initAnalytics()
initNative()

function ErrorFallback({ resetError }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 24, textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1C1C1E', marginBottom: 8 }}>Oups, Amiv a trébuché.</div>
        <div style={{ fontSize: 15, color: '#8E8E93', marginBottom: 20 }}>Recharge l'app pour repartir proprement.</div>
        <button type="button" onClick={resetError} style={{ border: 'none', borderRadius: 12, background: '#1C1C1E', color: '#fff', padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
