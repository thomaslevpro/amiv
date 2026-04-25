const tagStyles = {
  pink: { background: 'rgba(224,85,170,0.10)', color: '#e055aa' },
  blue: { background: 'rgba(0,122,255,0.10)', color: '#007AFF' },
  green: { background: 'rgba(52,199,89,0.10)', color: '#34C759' },
  gray: { background: '#F2F2F7', color: '#6B6B6B' },
}

export default function EventCard({ event, onClick }) {
  return (
    <div onClick={() => onClick(event)} style={{
      background: '#fff', borderRadius: 20, marginBottom: 20,
      overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', cursor: 'pointer',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, background: '#FBBF9A', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {event.emoji}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{event.name}</div>
            <div style={{ fontSize: 11, color: '#8E8E93' }}>{event.age}</div>
          </div>
        </div>
        <div style={{ fontSize: 18, color: '#AEAEB2', letterSpacing: 1 }}>···</div>
      </div>

      {/* Banner */}
      <div style={{
        background: '#FFF5F0', margin: '0 12px', borderRadius: 14,
        padding: '22px 16px 16px', textAlign: 'center',
      }}>
        <span style={{ fontSize: 40, display: 'block', marginBottom: 7 }}>{event.emoji}</span>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>{event.eventName}</div>
        <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 3 }}>{event.date}</div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 6px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 3 }}>{event.eventName}</div>
        <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 10 }}>📍 {event.location}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {event.tags.map((tag, i) => (
            <div key={i} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              ...tagStyles[tag.type]
            }}>
              {tag.label}
            </div>
          ))}
          <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, ...tagStyles.gray }}>
            👥 {event.guests} invités
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
        <div style={{
          flex: 1, padding: '11px 14px',
          background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
          borderRadius: 12, fontSize: 13, fontWeight: 600, textAlign: 'center',
        }}>
          Voir l'événement
        </div>
        <div style={{
          padding: '11px 16px', background: '#F2F2F7', color: '#1C1C1E',
          borderRadius: 12, fontSize: 13, fontWeight: 600,
        }}>
          📤 Partager
        </div>
      </div>
    </div>
  )
}
