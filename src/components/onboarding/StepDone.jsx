import { useEffect, useState } from 'react'
import { hapticSuccess } from '../../lib/haptics'
import Confetti from './Confetti'
import { BLACK, GRADIENT, GRAY, OnboardingScreen, PrimaryButton } from './OnboardingUI'

// Étape 8 : l'onboarding est déjà enregistré comme terminé à l'arrivée ici.
export default function StepDone({ firstName, onFinish }) {
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    hapticSuccess()
    const timer = window.setTimeout(() => setShowConfetti(false), 4500)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <OnboardingScreen
      screenKey="done"
      contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
      footer={<PrimaryButton onClick={onFinish}>Découvrir Amiv</PrimaryButton>}
    >
      {showConfetti && <Confetti />}
      <div className="ob-pop" style={{ fontSize: 92, lineHeight: 1, marginBottom: 26 }}>🎉</div>
      <h1 className="ob-rise" style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, color: BLACK, lineHeight: 1.1, margin: '0 0 14px' }}>
        C'est parti,{' '}
        <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{firstName || 'toi'}</span> !
      </h1>
      <p className="ob-rise" style={{ fontSize: 15, color: GRAY, lineHeight: 1.6, maxWidth: 290, margin: 0 }}>
        Ton compte est prêt. Les anniversaires et les fêtes de tes proches t'attendent.
      </p>
    </OnboardingScreen>
  )
}
