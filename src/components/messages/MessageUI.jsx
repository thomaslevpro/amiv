import { MessageCircle } from 'lucide-react'
import { BG, BLACK, CARD_SHADOW, FONT, GRADIENT, GRAY1, GRAY2, WHITE } from './constants'
import { getAvatarColor, getInitials } from './utils'

export function Avatar({ name, url, size = 50 }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: getAvatarColor(name),
      color: WHITE,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size > 48 ? 16 : 15,
      fontWeight: 700,
      flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  )
}

export function IconButton({ children, gradient = false, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: 'none',
        background: gradient ? GRADIENT : WHITE,
        boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export function SkeletonRow({ isLast }) {
  return (
    <div style={{ background: WHITE, borderRadius: 20, boxShadow: CARD_SHADOW, marginBottom: isLast ? 0 : 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', gap: 14, minHeight: 82 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: BG, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: '55%', height: 16, borderRadius: 8, background: BG, marginBottom: 8 }} />
          <div style={{ width: '80%', height: 13, borderRadius: 7, background: BG }} />
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ activeTab, onNewMessage }) {
  const subtitles = {
    events: "Tes discussions d'événements apparaîtront ici",
    directs: 'Tes messages privés apparaîtront ici',
    unread: 'Tu es à jour pour le moment',
    all: 'Tes discussions apparaîtront ici',
  }
  const showButton = activeTab === 'all' || activeTab === 'directs'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 32px', gap: 10 }}>
      <MessageCircle size={48} strokeWidth={1.5} color={GRAY2} />
      <div style={{ fontSize: 17, fontWeight: 600, color: BLACK, textAlign: 'center' }}>Aucune conversation</div>
      <div style={{ fontSize: 13, color: GRAY1, textAlign: 'center', lineHeight: 1.35 }}>{subtitles[activeTab]}</div>
      {showButton && (
        <button
          type="button"
          onClick={onNewMessage}
          style={{
            marginTop: 8,
            padding: '11px 18px',
            borderRadius: 12,
            border: 'none',
            background: GRADIENT,
            fontSize: 15,
            fontWeight: 700,
            color: WHITE,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Nouveau message
        </button>
      )}
    </div>
  )
}
