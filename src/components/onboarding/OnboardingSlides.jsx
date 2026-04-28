import { useState, useRef } from 'react'
import StatusBar from '../StatusBar'

const SLIDES = [
  {
    emoji: '🎂',
    title: "Ne manquez plus un anniversaire",
    desc: "Amiv vous rappelle chaque date importante.",
  },
  {
    emoji: '🎉',
    title: "Organisez des soirées inoubliables",
    desc: "Créez des événements, gérez les RSVP, chattez avec vos invités.",
  },
  {
    emoji: '💌',
    title: "Invitez sans que vos amis aient un compte",
    desc: "Un simple lien suffit pour partager votre événement.",
  },
]

export default function OnboardingSlides({ onNext, onLogin }) {
  const [idx, setIdx] = useState(0)
  const touchStartX = useRef(null)

  const goNext = () => {
    if (idx < SLIDES.length - 1) setIdx(idx + 1)
    else onNext()
  }

  const goPrev = () => {
    if (idx > 0) setIdx(idx - 1)
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -50) goNext()
    else if (dx > 50) goPrev()
    touchStartX.current = null
  }

  const s = SLIDES[idx]

  return (
    <div
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', userSelect: 'none' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <StatusBar />

      {/* Logo */}
      <div style={{ textAlign: 'center', padding: '20px 0 0' }}>
        <div style={{
          fontSize: 52, fontWeight: 900, letterSpacing: -2,
          background: 'linear-gradient(135deg,#e055aa,#f5a623)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1,
        }}>
          Amiv
        </div>
        <div style={{ fontSize: 14, color: '#8E8E93', marginTop: 4 }}>Friends come first</div>
      </div>

      {/* Slide content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 36px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 32 }}>{s.emoji}</div>
        <div style={{
          fontSize: 26, fontWeight: 800, letterSpacing: -0.5,
          color: '#1C1C1E', marginBottom: 14, lineHeight: 1.18,
        }}>
          {s.title}
        </div>
        <div style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.58, maxWidth: 280 }}>
          {s.desc}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '0 24px 48px' }}>
        {/* Dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{
                height: 8, borderRadius: 4, cursor: 'pointer',
                background: i === idx ? 'linear-gradient(90deg,#e055aa,#f5a623)' : 'rgba(0,0,0,0.10)',
                width: i === idx ? 22 : 8,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          style={{
            width: '100%', padding: 16, borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer',
            marginBottom: 14, boxShadow: '0 4px 18px rgba(224,85,170,0.35)',
            fontFamily: 'inherit',
          }}
        >
          {idx < SLIDES.length - 1 ? 'Continuer →' : 'Commencer 🎉'}
        </button>

        {onLogin && (
          <button
            onClick={onLogin}
            style={{
              width: '100%', padding: '10px 0', background: 'none', border: 'none',
              color: '#8E8E93', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            J'ai déjà un compte →
          </button>
        )}
      </div>
    </div>
  )
}
