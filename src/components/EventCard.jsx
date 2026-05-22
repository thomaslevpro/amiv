import { supabase } from '../lib/supabase'

export default function EventCard({ event = {}, onClick }) {
  const {
    name = 'Événement sans titre',
    date = '',
    location = '',
    role,
    cover_image,
  } = event

  const coverUrl = cover_image
    ? supabase.storage.from('event-covers').getPublicUrl(cover_image).data.publicUrl
    : null

  const d = date ? new Date(date) : null
  const dateStr = d && !isNaN(d)
    ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
    : 'Date à préciser'
  const badgeStr = d && !isNaN(d)
    ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : '—'

  const avatars = [
    { initiale: 'M', key: 'M' },
    { initiale: 'L', key: 'L' },
    { initiale: 'C', key: 'C' },
  ]

  return (
    <div
      onClick={() => onClick?.(event)}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'white',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        marginBottom: 16,
        cursor: 'pointer',
      }}
    >
      {/* Cover */}
      <div style={{
        height: 110,
        background: coverUrl ? '#000' : 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="cover"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
            }}
          />
        ) : null}
        <div style={{
          position: 'absolute',
          left: 14,
          right: 74,
          bottom: 12,
          color: '#fff',
          textShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dateStr} · {location || 'Lieu à préciser'}
          </div>
        </div>
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(255,255,255,0.25)',
          color: 'white',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          borderRadius: 20,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 700,
          zIndex: 1,
        }}>
          {badgeStr}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 2 }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 12 }}>
          {dateStr} · {location || 'Lieu à préciser'}
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Avatars */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {avatars.map((a, i) => (
              <div
                key={a.key}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#FBBF9A',
                  border: '2px solid white',
                  marginLeft: i === 0 ? 0 : -6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#b06040',
                  fontWeight: 700,
                  zIndex: avatars.length - i,
                  position: 'relative',
                }}
              >
                {a.initiale}
              </div>
            ))}
          </div>

          {/* Pill button */}
          <div style={{
            background: '#1C1C1E',
            color: 'white',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 16px',
            borderRadius: 20,
          }}>
            {role === 'organizer' ? 'Gérer' : 'Voir'}
          </div>
        </div>
      </div>
    </div>
  )
}
