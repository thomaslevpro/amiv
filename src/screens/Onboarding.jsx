import { useState } from 'react'
import StatusBar from '../components/StatusBar'

const slides = [
  {
    emoji: '🎂',
    title: "Ne manquez plus un anniversaire",
    highlight: 'anniversaire',
    desc: "Organisez des événements inoubliables et restez connecté avec vos proches toute l'année.",
  },
  {
    emoji: '📬',
    title: 'Invitez vos proches en 1 clic',
    highlight: '1 clic',
    desc: "Créez un événement, partagez le lien et gérez les RSVP en temps réel.",
  },
  {
    emoji: '🎉',
    title: 'Tous ensemble au bon moment',
    highlight: 'bon moment',
    desc: "Calendrier partagé, rappels automatiques et messagerie intégrée.",
  },
]

export default function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0)
  const s = slides[step]

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1)
    else onFinish(false)
  }

  function renderTitle(title, highlight) {
    const parts = title.split(highlight)
    return (
      <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1.15, marginBottom: 10, letterSpacing: -0.3, color: '#1C1C1E' }}>
        {parts[0]}
        <span style={{ background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {highlight}
        </span>
        {parts[1]}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 22px 20px', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
            Amiv
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#8E8E93', marginTop: 4 }}>Friends come first</div>
        </div>

        {/* Slide content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 20, lineHeight: 1 }}>{s.emoji}</div>
          {renderTitle(s.title, s.highlight)}
          <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.55, maxWidth: 260 }}>{s.desc}</div>
        </div>

        {/* Footer */}
        <div style={{ width: '100%' }}>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 26 }}>
            {slides.map((_, i) => (
              <div key={i} style={{
                height: 8, borderRadius: 4,
                background: i === step ? 'linear-gradient(90deg,#e055aa,#f5a623)' : 'rgba(0,0,0,0.10)',
                width: i === step ? 22 : 8,
                transition: 'all 0.3s ease',
              }}/>
            ))}
          </div>

          <div onClick={next} style={{
            width: '100%', padding: 16,
            background: 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff', borderRadius: 16, fontSize: 16, fontWeight: 700,
            marginBottom: 12, cursor: 'pointer', textAlign: 'center',
          }}>
            {step < slides.length - 1 ? 'Continuer →' : 'Commencer 🎉'}
          </div>

          <div onClick={() => onFinish(true)} style={{ fontSize: 13, color: '#8E8E93', textAlign: 'center', cursor: 'pointer', padding: '4px 0' }}>
            J'ai déjà un compte →
          </div>
        </div>
      </div>
    </div>
  )
}
