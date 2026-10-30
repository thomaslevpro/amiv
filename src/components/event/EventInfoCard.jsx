import { Cake, CalendarDays, MapPin } from 'lucide-react'
import GuestAvatar from './GuestAvatar'

function formatEventDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  const dayMonth = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayMonth} · ${time}`
}

export function openInMaps(location) {
  window.open(`https://maps.apple.com/?q=${encodeURIComponent(location)}`, '_blank', 'noopener,noreferrer')
}

const lineStyle = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 28, fontSize: 15, color: '#6B6B72' }
const iconBox = { width: 22, display: 'flex', justifyContent: 'center', flexShrink: 0 }
const linkStyle = { border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }

function organizerName(profile, userId) {
  if (profile?.id === userId) return 'toi'
  return profile?.first_name || profile?.name || 'Organisateur'
}

// Lignes d'infos de la feuille sous la couverture : date et lieu,
// organisateurs, personne fêtée.
export default function EventInfoCard({ displayDate, isPollActive, displayLocation, organizers, userId, birthday, onOpenProfile }) {
  const dateLabel = isPollActive ? null : formatEventDate(displayDate)
  const sortedOrganizers = [...organizers].filter(o => o.profile).sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={lineStyle}>
        <span style={iconBox}><CalendarDays size={18} strokeWidth={1.8} color="#8E8E93" /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {dateLabel || 'Date à définir'}
          {displayLocation && (
            <>
              {' · '}
              <button type="button" onClick={() => openInMaps(displayLocation)} style={{ ...linkStyle, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <MapPin size={14} strokeWidth={2} />
                <span style={{ textDecoration: 'underline', textDecorationColor: 'rgba(107,107,114,0.35)', textUnderlineOffset: 3 }}>{displayLocation}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {sortedOrganizers.length > 0 && (
        <div style={lineStyle}>
          <span style={{ ...iconBox, width: 'auto', minWidth: 22 }}>
            {sortedOrganizers.slice(0, 3).map(({ profile }, index) => (
              <span key={profile.id} style={{ marginLeft: index ? -8 : 0, borderRadius: '50%', border: index ? '2px solid #fff' : 'none', display: 'flex' }}>
                <GuestAvatar name={profile.first_name || profile.name} avatarUrl={profile.avatar_url} seed={profile.id} size={22} />
              </span>
            ))}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            Organisé par{' '}
            {sortedOrganizers.map(({ profile }, index) => (
              <span key={profile.id}>
                {index > 0 && (index === sortedOrganizers.length - 1 ? ' et ' : ', ')}
                <button type="button" onClick={() => onOpenProfile?.(profile)} disabled={!profile.username || profile.id === userId} style={{ ...linkStyle, fontWeight: 600, color: '#1C1C1E', cursor: profile.username && profile.id !== userId ? 'pointer' : 'default' }}>
                  {organizerName(profile, userId)}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {birthday?.name && (
        <div style={lineStyle}>
          <span style={iconBox}><Cake size={18} strokeWidth={1.8} color="#8E8E93" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            Pour <span style={{ fontWeight: 600, color: '#1C1C1E' }}>{birthday.isMe ? 'toi' : birthday.name}</span>
            {birthday.age ? ` · ${birthday.age} ans` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
