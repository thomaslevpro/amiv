import { useEffect, useRef, useState } from 'react'
import { Calendar as CalendarIcon, CalendarFold, EyeOff, Lock, MessageCircle, MoreHorizontal } from 'lucide-react'
import { BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { formatEventDateTime, previewMessage } from './utils'

function ChannelPreview({ type, message, unreadCount = 0, onClick, isOrganizer = false }) {
  if (type === 'secret' && isOrganizer) return null
  const isSecretChannel = type === 'secret'
  const preview = previewMessage(message?.content)
  const hasUnread = unreadCount > 0
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%',
          minWidth: 0,
          border: isSecretChannel ? 'none' : '0.5px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          background: isSecretChannel ? GRADIENT : '#f5f5f7',
          padding: '10px 11px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: FONT,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isSecretChannel ? (
          <Lock size={14} strokeWidth={2.2} color={WHITE} style={{ flexShrink: 0 }} />
        ) : (
          <MessageCircle size={14} strokeWidth={2} color={GRAY1} style={{ flexShrink: 0 }} />
        )}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: isSecretChannel ? WHITE : BLACK, lineHeight: 1.2 }}>
            {isSecretChannel ? 'Secret' : 'Général'}
          </span>
          <span style={{
            display: 'block',
            marginTop: 2,
            fontSize: 11,
            color: isSecretChannel ? 'rgba(255,255,255,0.75)' : GRAY1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.25,
          }}>
            {preview.text}
          </span>
        </span>
        {hasUnread && (
          <span style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isSecretChannel ? WHITE : '#FF3B30',
            boxShadow: isSecretChannel ? '0 0 0 2px rgba(224,85,170,0.65)' : '0 0 0 2px #f5f5f7',
          }} />
        )}
      </button>
    </div>
  )
}

export default function EventConversationCard({ conversation, onOpenChannel, onHide, currentUserId }) {
  const [showMenu, setShowMenu] = useState(false)
  const menuContainerRef = useRef(null)
  const event = conversation.event ?? {}
  const isOrganizer = !!currentUserId && !!event.user_id && currentUserId === event.user_id

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
      <div style={{ width: '100%', background: 'transparent', padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', fontFamily: FONT }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarFold size={20} strokeWidth={1.7} color={WHITE} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversation.title}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: GRAY1, minWidth: 0 }}>
            <CalendarIcon size={11} strokeWidth={1.9} color={GRAY1} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatEventDateTime(event.date)}</span>
          </div>
        </div>
      </div>

      <div ref={menuContainerRef} style={{ position: 'absolute', top: 10, right: 10 }}>
        <button
          type="button"
          aria-label="Options de la conversation"
          onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
          style={{ width: 28, height: 28, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
        >
          <MoreHorizontal size={18} color={GRAY1} strokeWidth={2} />
        </button>
        {showMenu && (
          <div style={{ position: 'absolute', top: 32, right: 0, zIndex: 50, background: WHITE, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '0.5px solid rgba(0,0,0,0.08)', padding: '4px 0', minWidth: 180 }}>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setShowMenu(false); onHide?.() }}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#FF3B30', fontWeight: 500, cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}
            >
              <EyeOff size={15} strokeWidth={2} color="#FF3B30" />
              Masquer la conversation
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}>
        <ChannelPreview type="general" message={conversation.generalMessage} unreadCount={conversation.generalUnreadCount || 0} onClick={() => onOpenChannel(false)} />
        <ChannelPreview type="secret" message={conversation.secretMessage} unreadCount={conversation.secretUnreadCount || 0} onClick={() => onOpenChannel(true)} isOrganizer={isOrganizer} />
      </div>
    </div>
  )
}
