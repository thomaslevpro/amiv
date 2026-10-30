import { useState } from 'react'
import { requestPushPermission, snoozePushPrompt } from '../lib/push'
import { track } from '../lib/analytics'

// Texte de l'écran d'explication, partagé avec l'étape « Notifications » de
// l'onboarding (components/onboarding/StepNotifications).
export const PUSH_EXPLANATION = {
  emoji: '🎂',
  title: 'Sois prévenu des anniversaires de tes amis',
  text: "Amiv te rappelle les anniversaires de tes proches et te prévient quand tu es invité à un événement. Tu peux choisir ce que tu reçois dans ton profil.",
}

// Écran d'explication proposé à nouveau après l'onboarding (« Plus tard »
// il y a plus d'une semaine), avant la demande d'autorisation iOS (qui ne
// peut être posée qu'une seule fois).
export default function PushPermissionPrompt({ onDone }) {
  const [loading, setLoading] = useState(false)

  const handleEnable = async () => {
    setLoading(true)
    const granted = await requestPushPermission()
    track('push_permission_answered', { granted })
    setLoading(false)
    onDone()
  }

  const handleLater = async () => {
    track('push_permission_snoozed')
    await snoozePushPrompt()
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      display: 'flex', flexDirection: 'column', background: '#FFFFFF',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 36px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 28 }}>{PUSH_EXPLANATION.emoji}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1C1C1E', letterSpacing: -0.5, marginBottom: 12, lineHeight: 1.2 }}>
          {PUSH_EXPLANATION.title}
        </div>
        <div style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.6, maxWidth: 290 }}>
          {PUSH_EXPLANATION.text}
        </div>
      </div>

      <div style={{ padding: '0 24px 32px' }}>
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
          onClick={handleLater}
          disabled={loading}
          style={{
            width: '100%', padding: 14, background: 'none', border: 'none',
            color: '#8E8E93', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
