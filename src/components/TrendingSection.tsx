import { ArrowUpRight } from 'lucide-react'

const trendingEvents = [
  {
    id: 1,
    title: 'Coffee time',
    subtitle: 'Un moment café ? Rejoins tes amis ☕',
    cta: 'Organiser un café',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    overlayColor: 'rgba(139, 90, 43, 0.65)',
    eventType: 'cafe',
    createType: 'Autre',
    emoji: '☕',
  },
  {
    id: 2,
    title: 'Dîner entre amis',
    subtitle: 'Du homard 🦞',
    cta: 'Organiser un dîner',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    overlayColor: 'rgba(30, 110, 90, 0.65)',
    eventType: 'dinner',
    createType: 'Repas',
    emoji: '🍽️',
  },
  {
    id: 3,
    title: 'Soirée jeux',
    subtitle: 'Une nuit de stratégie 🎲',
    cta: 'Organiser une soirée',
    image: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&q=80',
    overlayColor: 'rgba(80, 50, 140, 0.65)',
    eventType: 'games',
    createType: 'Soirée',
    emoji: '🎲',
  },
]

type TrendingEvent = (typeof trendingEvents)[number]

type TrendingSectionProps = {
  onCreateEvent?: (data: {
    title: string
    type: string
    eventType: string
    emoji: string
  }) => void
}

export default function TrendingSection({ onCreateEvent }: TrendingSectionProps) {
  function handleCreate(event: TrendingEvent) {
    onCreateEvent?.({
      title: event.title,
      type: event.createType,
      eventType: event.eventType,
      emoji: event.emoji,
    })
  }

  return (
    <section style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 12,
          padding: '0 2px',
        }}
      >
        <ArrowUpRight size={15} color="#e055aa" strokeWidth={2.7} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--gray1)',
          }}
        >
          TRENDING NOW
        </span>
      </div>

      <style>{`[data-trending-section-scroll]::-webkit-scrollbar { display: none; }`}</style>
      <div
        data-trending-section-scroll
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
        {trendingEvents.map(event => (
          <article
            key={event.id}
            onClick={() => handleCreate(event)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              width: 160,
              height: 110,
              flexShrink: 0,
              borderRadius: 16,
              cursor: 'pointer',
              background: 'var(--black)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <img
              src={event.image}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.75) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                bottom: 9,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <h3
                  style={{
                    color: '#fff',
                    fontSize: 13,
                    lineHeight: 1.15,
                    fontWeight: 700,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 5px rgba(0,0,0,0.28)',
                  }}
                >
                  {event.title}
                </h3>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.80)',
                    fontSize: 11,
                    lineHeight: 1.2,
                    fontWeight: 500,
                    margin: '2px 0 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.subtitle}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
