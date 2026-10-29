import { useEffect, useRef, useState } from 'react'
import { CalendarFold, EyeOff, Lock, MessageCircle, MoreHorizontal, Trash2 } from 'lucide-react'
import { BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { formatEventDateTime } from './utils'
import { getCoverUrl } from '../home/MyEventsSection'

function UnreadBadge({ secret = false, count, label }) {
  const Icon = secret ? Lock : MessageCircle
  const color = secret ? WHITE : '#B8287A'
  return (
    <span aria-label={label} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      height: 22,
      padding: '0 7px',
      borderRadius: 11,
      background: secret ? BLACK : '#FCE4F1',
      color,
      fontSize: 12,
      fontWeight: 700,
      flexShrink: 0,
    }}>
      <Icon size={12} strokeWidth={2.4} color={color} />
      {count > 99 ? '99+' : count}
    </span>
  )
}

function EventIcon({ coverUrl }) {
  const [failed, setFailed] = useState(false)
  return (
    <div style={{ width: 44, height: 44, borderRadius: 12, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
      {coverUrl && !failed
        ? <img src={coverUrl} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <CalendarFold size={22} strokeWidth={1.7} color={WHITE} />}
    </div>
  )
}

// Canal ouvert au toucher : celui qui a des non lus, Général en priorité.
export function initialEventChannelIsSecret(conversation, canSeeSecret) {
  return canSeeSecret && !(conversation.generalUnreadCount > 0) && conversation.secretUnreadCount > 0
}

export default function EventConversationCard({ conversation, onOpenChannel, onHide, onDelete, currentUserId }) {
  const [showMenu, setShowMenu] = useState(false)
  const menuContainerRef = useRef(null)
  const event = conversation.event ?? {}
  // Le canal secret n'existe pas pour la personne fêtée
  const canSeeSecret = !!event.birthday_person_user_id && currentUserId !== event.birthday_person_user_id
  const generalUnread = conversation.generalUnreadCount || 0
  const secretUnread = canSeeSecret ? conversation.secretUnreadCount || 0 : 0
  const hasUnread = generalUnread + secretUnread > 0
  const subtitle = [formatEventDateTime(event.date), event.location?.trim()].filter(Boolean).join(' · ')

  useEffect(() => {
    if (!showMenu) return undefined
    function handleOutside(e) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [showMenu])

  return (
    <div style={{ background: WHITE, borderRadius: 20, marginBottom: 10, position: 'relative', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.04)' }}>
      <button
        type="button"
        onClick={() => onOpenChannel(initialEventChannelIsSecret(conversation, canSeeSecret))}
        style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 44px 12px 12px', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', fontFamily: FONT, cursor: 'pointer' }}
      >
        <EventIcon coverUrl={getCoverUrl(event.cover_image)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: hasUnread ? 700 : 500, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversation.title}
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: GRAY1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        </div>
        {hasUnread && (
          <span style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {generalUnread > 0 && <UnreadBadge count={generalUnread} label={`${generalUnread} non lu${generalUnread > 1 ? 's' : ''} dans Général`} />}
            {secretUnread > 0 && <UnreadBadge secret count={secretUnread} label={`${secretUnread} non lu${secretUnread > 1 ? 's' : ''} dans Secret`} />}
          </span>
        )}
      </button>

      <div ref={menuContainerRef} style={{ position: 'absolute', top: 0, bottom: 0, right: 8, zIndex: showMenu ? 60 : undefined, display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          aria-label="Options de la conversation"
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
          style={{ width: 28, height: 28, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
        >
          <MoreHorizontal size={18} color={GRAY1} strokeWidth={2} />
        </button>
        {showMenu && (
          <div style={{ position: 'absolute', top: 'calc(50% + 18px)', right: 0, zIndex: 50, whiteSpace: 'nowrap', background: WHITE, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '0.5px solid rgba(0,0,0,0.08)', padding: '4px 0', minWidth: 210, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setShowMenu(false); onHide?.() }}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#FF3B30', fontWeight: 500, cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}
            >
              <EyeOff size={15} strokeWidth={2} color="#FF3B30" />
              Masquer la conversation
            </button>
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.08)', marginLeft: 41 }} />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setShowMenu(false); onDelete?.() }}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#FF3B30', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}
            >
              <Trash2 size={15} strokeWidth={2} color="#FF3B30" />
              Supprimer définitivement
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
