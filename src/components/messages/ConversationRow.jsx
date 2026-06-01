import { useRef, useState } from 'react'
import { BellOff, Mic, Trash2 } from 'lucide-react'
import { BLACK, CARD_SHADOW, DELETE_REVEAL_WIDTH, FONT, GRADIENT, GRAY1, GRAY2, WHITE } from './constants'
import { formatConvTime, previewMessage } from './utils'
import { Avatar } from './MessageUI'

function EventAvatar({ emoji, size = 50 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 18,
      background: 'linear-gradient(135deg, rgba(224,85,170,0.10), rgba(245,166,35,0.10))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size > 52 ? 24 : 22,
      flexShrink: 0,
    }}>
      {emoji || '🎉'}
    </div>
  )
}

export default function ConversationRow({ conversation, isLast, onClick, onDelete }) {
  const unread = conversation.unreadCount > 0
  const preview = previewMessage(conversation.lastMessage?.content)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const pointerRef = useRef(null)
  const suppressClickRef = useRef(false)

  function handlePointerDown(event) {
    pointerRef.current = { x: event.clientX, y: event.clientY, offset, active: true }
    suppressClickRef.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event) {
    const pointer = pointerRef.current
    if (!pointer?.active) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    if (Math.abs(dy) > Math.abs(dx) && offset === 0) return
    const nextOffset = Math.min(0, Math.max(-DELETE_REVEAL_WIDTH, pointer.offset + dx))
    setOffset(nextOffset)
    setDragging(true)
    if (Math.abs(dx) > 8) suppressClickRef.current = true
  }

  function handlePointerUp(event) {
    pointerRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setOffset(current => (current < -DELETE_REVEAL_WIDTH / 2 ? -DELETE_REVEAL_WIDTH : 0))
    window.setTimeout(() => setDragging(false), 0)
  }

  function handleClick(event) {
    if (suppressClickRef.current || offset < 0) {
      event.preventDefault()
      setOffset(0)
      suppressClickRef.current = false
      return
    }
    onClick()
  }

  function handleDelete(event) {
    event.stopPropagation()
    setOffset(0)
    onDelete()
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: '#FF3B30', borderRadius: 20, boxShadow: CARD_SHADOW, marginBottom: 10 }}>
      <button
        type="button"
        aria-label={`Supprimer ${conversation.title}`}
        onClick={handleDelete}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: DELETE_REVEAL_WIDTH, border: 'none', background: '#FF3B30', color: WHITE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 750, fontFamily: FONT, cursor: 'pointer' }}
      >
        <Trash2 size={18} strokeWidth={2.2} color={WHITE} />
        Supprimer
      </button>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.18s ease', touchAction: 'pan-y', background: WHITE, borderRadius: 20 }}
      >
        <button
          type="button"
          onClick={handleClick}
          style={{ width: '100%', border: 'none', background: WHITE, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, borderRadius: 20, minHeight: 82 }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {conversation.kind === 'event' ? <EventAvatar emoji={conversation.emoji} size={56} /> : <Avatar name={conversation.title} url={conversation.avatarUrl} size={56} />}
            {unread && (
              <div style={{ position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: GRADIENT, border: `2px solid ${WHITE}`, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, lineHeight: 1 }}>
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 800, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conversation.title}
              </div>
              {conversation.isMuted && <BellOff size={14} strokeWidth={1.8} color={GRAY2} />}
              <div style={{ fontSize: 14, color: GRAY2, flexShrink: 0 }}>{formatConvTime(conversation.lastAt)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 15, color: unread ? BLACK : GRAY1, fontWeight: unread ? 800 : 400, minWidth: 0 }}>
              {preview.voice && <Mic size={16} strokeWidth={2} color={unread ? BLACK : GRAY1} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {preview.text}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
