import { useState } from 'react'
import StatusBar from '../StatusBar'

export default function OnboardingNotifications({ onNext }) {
  const [loading, setLoading] = useState(false)

  const handleEnable = async () => {
    setLoading(true)
    try {
      if ('Notification' in window) {
        await Notification.requestPermission()
      }
    } catch {
      // permission denied or unsupported — proceed anyway
    }
    setLoading(false)
    onNext()
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#F2F2F7' }}>
      <StatusBar />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 36px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 28 }}>🔔</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1C1C1E', letterSpacing: -0.5, marginBottom: 12, lineHeight: 1.2 }}>
          Ne rien rater
        </div>
        <div style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.6, maxWidth: 280 }}>
          Activez les notifications pour recevoir vos rappels d'anniversaires et les messages de vos invités.
        </div>
      </div>

      <div style={{ padding: '0 24px 48px' }}>
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            width: '100%', padding: 16, borderRadius: 16, border: 'none',
            background: loading ? '#C7C7CC' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff', fontSize: 17, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 18px rgba(224,85,170,0.35)',
            marginBottom: 12, fontFamily: 'inherit',
          }}
        >
          {loading ? 'Demande en cours…' : 'Activer les notifications'}
        </button>

        <button
          onClick={onNext}
          style={{
            width: '100%', padding: 14, background: 'none', border: 'none',
            color: '#8E8E93', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Passer
        </button>
      </div>
    </div>
  )
}
