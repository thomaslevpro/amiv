import { useEffect, useState, useRef } from 'react'
import StatusBar from '../StatusBar'

const COLORS = ['#e055aa', '#f5a623', '#34C759', '#007AFF', '#FF3B30', '#5856D6', '#FF9500']

function useConfettiPieces(count = 40) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.2 + Math.random() * 1.2,
      size: 6 + Math.random() * 9,
      isCircle: i % 3 === 0,
    }))
  )
  return pieces.current
}

function Confetti() {
  const pieces = useConfettiPieces()

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10 }}>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-24px) rotate(0deg);   opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(680deg); opacity: 0; }
        }
        @keyframes confetti-wobble {
          0%, 100% { margin-left: 0; }
          25%       { margin-left: 12px; }
          75%       { margin-left: -12px; }
        }
      `}</style>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: -24,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? '50%' : 2,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards,
                        confetti-wobble ${p.duration * 0.6}s ${p.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  )
}

export default function OnboardingDone({ onComplete }) {
  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {showConfetti && <Confetti />}
      <StatusBar />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 36px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 28 }}>🎉</div>
        <div style={{
          fontSize: 34, fontWeight: 900, letterSpacing: -1,
          color: '#1C1C1E', marginBottom: 14, lineHeight: 1.1,
        }}>
          Tout est prêt !
        </div>
        <div style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.65, maxWidth: 280 }}>
          Bienvenue sur Amiv. Commencez à créer des souvenirs inoubliables avec vos proches.
        </div>
      </div>

      <div style={{ padding: '0 24px 52px' }}>
        <button
          onClick={onComplete}
          style={{
            width: '100%', padding: 16, borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(224,85,170,0.35)', fontFamily: 'inherit',
          }}
        >
          Découvrir Amiv 🚀
        </button>
      </div>
    </div>
  )
}
