import { ArrowUpRight, ChevronRight } from 'lucide-react'

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {trendingEvents.map(event => (
          <article
            key={event.id}
            onClick={() => handleCreate(event)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 16,
              height: 180,
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
                backgroundColor: event.overlayColor,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <h3
                  style={{
                    color: '#fff',
                    fontSize: 25,
                    lineHeight: 1.05,
                    fontWeight: 900,
                    letterSpacing: 0,
                    margin: 0,
                    textShadow: '0 2px 10px rgba(0,0,0,0.20)',
                  }}
                >
                  {event.title}
                </h3>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 13,
                    lineHeight: 1.35,
                    fontWeight: 500,
                    margin: '6px 0 0',
                  }}
                >
                  {event.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  handleCreate(event)
                }}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 999,
                  background: '#fff',
                  color: 'var(--black)',
                  padding: '10px 14px 10px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1,
                  boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
                  whiteSpace: 'nowrap',
                }}
              >
                {event.cta}
                <ChevronRight size={15} strokeWidth={2.5} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
