import { Clock, MoreHorizontal } from 'lucide-react'

const moodEmoji = {
  cafe: '☕',
  jeux: '🎲',
  diner: '🍽️',
  cine: '🎬',
  apero: '🍻',
  balade: '🚶',
}

const visibilityLabels = {
  all: 'Tous mes amis',
  close: 'Amis proches',
  friends: 'Tous mes amis',
  close_friends: 'Amis proches',
}

function displayName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ') || 'Ami'
}

function initials(profile) {
  const first = profile?.first_name?.[0] ?? ''
  const last = profile?.name?.[0] ?? ''
  return `${first}${last || (!first ? 'A' : '')}`.toUpperCase()
}

function relativeHours(value) {
  const created = new Date(value).getTime()
  const diffHours = Math.max(0, Math.floor((Date.now() - created) / 3600000))
  if (diffHours < 1) return "à l'instant"
  if (diffHours < 24) return `il y a ${diffHours}h`
  return `il y a ${Math.floor(diffHours / 24)}j`
}

function expireLabel(value) {
  const date = new Date(value)
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long' })
  return `Expire ${day} soir`
}

function avatar(profile, size = 34) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.max(10, size * 0.34),
      fontWeight: 800,
      flexShrink: 0,
    }}>
      {initials(profile)}
    </div>
  )
}

export default function AvailabilityCard({ post, currentUserId, onRespond, onConvert, onOpenDetail }) {
  const profile = post.profiles
  const responses = post.going_responses ?? []
  const goingCount = post.going_count ?? responses.length ?? 0
  const hasResponded = responses.some(response => response.user_id === currentUserId)
  const canConvert = goingCount >= 3 && !post.converted_event_id && currentUserId === post.user_id

  return (
    <div
      onClick={() => onOpenDetail?.(post.id)}
      style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        marginBottom: 14,
        padding: 16,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {avatar(profile)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#1C1C1E', fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName(profile)}
          </div>
          <div style={{ color: '#8E8E93', fontSize: 12, fontWeight: 500 }}>
            {relativeHours(post.created_at)} · {visibilityLabels[post.visibility] ?? post.visibility ?? 'Tous mes amis'}
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          style={{ border: 'none', background: 'transparent', color: '#8E8E93', padding: 6, cursor: 'pointer' }}
        >
          <MoreHorizontal size={22} strokeWidth={2} />
        </button>
      </div>

      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'rgba(255,59,48,0.10)',
        color: '#FF3B30',
        borderRadius: 999,
        padding: '5px 9px',
        fontSize: 11,
        fontWeight: 800,
        marginBottom: 10,
      }}>
        <Clock size={13} strokeWidth={2.2} />
        {expireLabel(post.expires_at)}
      </div>

      <div style={{ color: '#1C1C1E', fontSize: 15, fontWeight: 600, lineHeight: 1.35, marginBottom: 12 }}>
        {post.message}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {(post.moods ?? []).map(mood => (
          <span key={mood} style={{ background: '#F2F2F7', borderRadius: 999, padding: '6px 10px', fontSize: 13, fontWeight: 700, color: '#3A3A3C' }}>
            {moodEmoji[mood] ?? '🟢'} {mood}
          </span>
        ))}
      </div>

      {canConvert && (
        <div
          onClick={(event) => { event.stopPropagation(); onConvert?.(post) }}
          style={{
            background: 'rgba(0,122,255,0.10)',
            color: '#007AFF',
            borderRadius: 14,
            padding: '10px 12px',
            fontSize: 13,
            fontWeight: 800,
            marginBottom: 12,
            cursor: 'pointer',
          }}
        >
          {goingCount} amis sont partants ! → Créer l'événement
        </div>
      )}

      {post.converted_event_id ? (
        <div style={{ color: '#34C759', background: 'rgba(52,199,89,0.10)', borderRadius: 14, padding: '10px 12px', fontSize: 13, fontWeight: 800 }}>
          Converti en événement ✓
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', marginRight: 8 }}>
              {responses.slice(0, 3).map((response, index) => (
                <div key={response.id ?? response.user_id} style={{ marginLeft: index ? -8 : 0, border: '2px solid #fff', borderRadius: '50%' }}>
                  {avatar(response.profiles, 24)}
                </div>
              ))}
            </div>
            <span style={{ color: '#8E8E93', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {goingCount} partant{goingCount > 1 ? 's' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onRespond?.(post.id, 'going', post.moods ?? []) }}
            style={{
              border: hasResponded ? '1.5px solid #e055aa' : 'none',
              background: hasResponded ? '#fff' : 'linear-gradient(135deg,#e055aa,#f5a623)',
              color: hasResponded ? '#e055aa' : '#fff',
              borderRadius: 999,
              padding: '9px 13px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {hasResponded ? '✓ Partant' : 'Je suis partant !'}
          </button>
        </div>
      )}
    </div>
  )
}
