import { useState } from 'react'
import { requestPushPermission, snoozePushPrompt } from '../../lib/push'
import { track } from '../../lib/analytics'
import { hapticSuccess } from '../../lib/haptics'
import { PUSH_EXPLANATION } from '../PushPermissionPrompt'
import { BLACK, GRAY, IconBadge, OnboardingScreen, PrimaryButton } from './OnboardingUI'

// Étape 7 (facultative, iPhone) : écran d'explication, puis demande iOS
// (posée une seule fois par iOS). « Plus tard » : reproposée une semaine après.
export default function StepNotifications({ header, direction, onDone }) {
  const [loading, setLoading] = useState(false)

  async function handleEnable() {
    setLoading(true)
    const granted = await requestPushPermission()
    track('push_permission_answered', { granted, source: 'onboarding' })
    setLoading(false)
    if (granted) hapticSuccess()
    else await snoozePushPrompt()
    onDone({ granted })
  }

  return (
    <OnboardingScreen
      header={header}
      direction={direction}
      screenKey="notifications"
      contentStyle={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}
      footer={<PrimaryButton onClick={handleEnable} loading={loading}>{loading ? 'Demande en cours…' : 'Activer les notifications'}</PrimaryButton>}
    >
      <div className="ob-pop" style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
        <IconBadge icon={PUSH_EXPLANATION.icon} size={88} iconSize={42} />
      </div>
      <h1 className="ob-rise" style={{ fontSize: 28, fontWeight: 800, color: BLACK, letterSpacing: -0.5, lineHeight: 1.2, margin: '0 0 12px' }}>{PUSH_EXPLANATION.title}</h1>
      <p className="ob-rise" style={{ fontSize: 15, color: GRAY, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>{PUSH_EXPLANATION.text}</p>
    </OnboardingScreen>
  )
}
