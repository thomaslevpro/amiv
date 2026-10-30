import { useEffect, useRef, useState } from 'react'
import { BLACK, GRAY, GRADIENT, OnboardingScreen, PrimaryButton, SecondaryButton } from './OnboardingUI'

const CARDS = [
  { emoji: '🎂', title: 'Ne rate plus aucun anniversaire', text: 'Amiv te prévient à l\'avance, pour tous tes proches.', tint: '#FFF0F7' },
  { emoji: '🎉', title: 'Organise la fête en 2 minutes', text: 'Invitations, réponses et discussion au même endroit.', tint: '#FFF6E8' },
  { emoji: '🤫', title: 'Prépare la surprise en secret', text: 'Un espace caché de la personne fêtée, pour tout préparer.', tint: '#F3F0FF' },
]
const AUTOPLAY_MS = 3500

// Étape 0 : avant d'avoir un compte
export default function Welcome({ onSignup, onLogin }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef(null)

  useEffect(() => {
    if (paused) return undefined
    const timer = window.setInterval(() => setIndex(i => (i + 1) % CARDS.length), AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [paused])

  const go = next => {
    setIndex((next + CARDS.length) % CARDS.length)
    setPaused(true)
  }

  return (
    <OnboardingScreen
      screenKey="welcome"
      contentStyle={{ display: 'flex', flexDirection: 'column', padding: '24px 0 8px' }}
      footer={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryButton onClick={onSignup}>Créer un compte</PrimaryButton>
          <SecondaryButton onClick={onLogin}>J'ai déjà un compte</SecondaryButton>
        </div>
      )}
    >
      <div className="ob-rise" style={{ textAlign: 'center', padding: '12px 24px 0' }}>
        <div style={{ fontSize: 58, fontWeight: 900, letterSpacing: -2, lineHeight: 1, background: GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Amiv
        </div>
        <div style={{ fontSize: 17, color: BLACK, fontWeight: 600, marginTop: 12, lineHeight: 1.35 }}>
          L'essentiel, c'est d'être ensemble
        </div>
      </div>

      <div
        style={{ flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', marginTop: 20 }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touchStartX.current == null) return
          const dx = e.changedTouches[0].clientX - touchStartX.current
          if (dx < -40) go(index + 1)
          else if (dx > 40) go(index - 1)
          touchStartX.current = null
        }}
      >
        <div
          aria-live="polite"
          style={{ display: 'flex', transform: `translateX(-${index * 100}%)`, transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {CARDS.map((card, i) => (
            <div key={card.title} aria-hidden={i !== index} style={{ flex: '0 0 100%', padding: '0 24px', boxSizing: 'border-box' }}>
              <div style={{ background: card.tint, borderRadius: 28, padding: '34px 24px', textAlign: 'center', minHeight: 230, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>{card.emoji}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: BLACK, letterSpacing: -0.3, lineHeight: 1.2, marginBottom: 10 }}>{card.title}</div>
                <div style={{ fontSize: 15, color: GRAY, lineHeight: 1.5, maxWidth: 280 }}>{card.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18 }}>
          {CARDS.map((card, i) => (
            <button
              key={card.title}
              type="button"
              aria-label={`Carte ${i + 1} : ${card.title}`}
              onClick={() => go(i)}
              style={{ height: 8, width: i === index ? 22 : 8, borderRadius: 4, border: 'none', padding: 0, cursor: 'pointer', background: i === index ? GRADIENT : 'rgba(0,0,0,0.12)', transition: 'all 0.3s ease' }}
            />
          ))}
        </div>
      </div>
    </OnboardingScreen>
  )
}
