import { useRef } from 'react'

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

// Confettis de la fin de l'onboarding
export default function Confetti() {
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
