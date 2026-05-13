const cards = [
  {
    title: 'Coffee time',
    emoji: '☕',
    label: 'Populaire en ce moment',
    subtitle: "Une pause café s'impose, non ?",
    cta: 'Organiser un café →',
    emojis: ['☕', '🥐', '💬'],
    bgColor: '#18101a',
    blobs: ['#e055aa', '#f5a623'],
    blob1: { top: -20, left: 18, size: 122 },
    blob2: { bottom: 18, right: 18, size: 88 },
  },
  {
    title: 'Dîner entre amis',
    emoji: '🍽️',
    label: 'Ce week-end',
    subtitle: 'Les meilleurs dîners sont improvisés',
    cta: 'Organiser un dîner →',
    emojis: ['🥂', '🍝', '🕯️'],
    bgColor: '#0d1710',
    blobs: ['#34C759', '#1D9E75'],
    blob1: { top: -24, right: 20, size: 116 },
    blob2: { bottom: 20, left: 16, size: 86 },
  },
  {
    title: "Planif' voyage d'été",
    emoji: '✈️',
    label: 'Saison estivale',
    subtitle: "Organise les vacances avant qu'il soit trop tard",
    cta: "Lancer la planif' →",
    emojis: ['🏖️', '✈️', '🗺️'],
    bgColor: '#0a1020',
    blobs: ['#007AFF', '#5856D6'],
    blob1: { top: -20, left: 72, size: 128 },
    blob2: { bottom: 16, right: 18, size: 90 },
  },
  {
    title: 'Soirée ciné',
    emoji: '🎬',
    label: 'Soirée culte',
    subtitle: 'Canapé, pop-corn, film culte — qui est partant ?',
    cta: 'Organiser une soirée →',
    emojis: ['🎬', '🍿', '🛋️'],
    bgColor: '#100a0a',
    blobs: ['#FF3B30', '#FF9500'],
    blob1: { top: -22, right: 34, size: 120 },
    blob2: { bottom: 18, left: 22, size: 84 },
  },
]

const miniCardTransforms = [
  'rotate(-8deg) translateY(4px)',
  'rotate(2deg)',
  'rotate(9deg) translateY(6px)',
]

export default function TrendingNow({ onCardClick }) {
  return (
    <>
      <style>{`[data-trending-now]::-webkit-scrollbar { display: none; }`}</style>
      <div
        data-trending-now
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: '0 16px',
          margin: '0 -16px',
        }}
      >
        {cards.map(card => (
          <div
            key={card.title}
            onClick={() => onCardClick?.({ title: card.title, emoji: card.emoji })}
            style={{
              position: 'relative',
              width: 280,
              height: 280,
              flexShrink: 0,
              borderRadius: 22,
              background: card.bgColor,
              padding: 18,
              overflow: 'hidden',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: card.blob1.size,
                height: card.blob1.size,
                borderRadius: '50%',
                background: card.blobs[0],
                filter: 'blur(46px)',
                opacity: 0.38,
                ...card.blob1,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: card.blob2.size,
                height: card.blob2.size,
                borderRadius: '50%',
                background: card.blobs[1],
                filter: 'blur(42px)',
                opacity: 0.38,
                ...card.blob2,
              }}
            />

            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 7 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)', lineHeight: 1.35 }}>
                {card.subtitle}
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 60,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                zIndex: 3,
              }}
            >
              {card.emojis.map((emoji, index) => (
                <div
                  key={`${card.title}-${emoji}`}
                  style={{
                    width: 56,
                    height: 66,
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    transform: miniCardTransforms[index],
                    marginRight: index === 0 ? -8 : 0,
                    marginLeft: index === 2 ? -8 : 0,
                    zIndex: index === 1 ? 3 : 2,
                    boxSizing: 'border-box',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>

            <button
              type="button"
              style={{
                position: 'absolute',
                left: 18,
                right: 18,
                bottom: 18,
                width: 'calc(100% - 36px)',
                border: 'none',
                borderRadius: 100,
                padding: '10px 20px',
                background: '#fff',
                color: '#1C1C1E',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                zIndex: 4,
                fontFamily: 'inherit',
              }}
            >
              {card.cta}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
