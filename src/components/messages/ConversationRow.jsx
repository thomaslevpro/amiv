import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellOff, Lock, MessageCircle, Mic } from 'lucide-react'
import { BG, BLACK, DELETE_REVEAL_WIDTH, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { formatConvTime, formatEventDateTime, isOwnMessage, previewMessage } from './utils'
import { Avatar, EventCover } from './MessageUI'
import { getCoverUrl } from '../home/MyEventsSection'

// Géométrie commune à toutes les lignes de la messagerie
export const ROW_HEIGHT = 72
export const ROW_PADDING_X = 16
export const ROW_IMAGE_SIZE = 52
export const ROW_GAP = 12
const LONG_PRESS_MS = 500

// Trait de 0,5 px qui commence au niveau du texte
function RowSeparator() {
  return <div style={{ position: 'absolute', left: ROW_PADDING_X + ROW_IMAGE_SIZE + ROW_GAP, right: 0, bottom: 0, height: 1, background: '#D8D8DC', transform: 'scaleY(0.5)', transformOrigin: 'bottom', pointerEvents: 'none' }} />
}

function UnreadBadge({ variant, count, label }) {
  const styles = {
    direct: { background: GRADIENT, color: WHITE },
    general: { background: '#FCE4F1', color: '#B8287A' },
    secret: { background: BLACK, color: WHITE },
  }[variant]
  const Icon = variant === 'secret' ? Lock : variant === 'general' ? MessageCircle : null
  return (
    <span aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, fontSize: 12, fontWeight: 700, lineHeight: 1, ...styles }}>
      {Icon && <Icon size={11} strokeWidth={2.4} color={styles.color} />}
      {count > 99 ? '99+' : count}
    </span>
  )
}

function unreadLabel(count, where) {
  return `${count} non lu${count > 1 ? 's' : ''}${where ? ` dans ${where}` : ''}`
}

// Canal ouvert au toucher : celui qui a des non lus, Général en priorité.
export function initialEventChannelIsSecret(conversation, canSeeSecret) {
  return canSeeSecret && !(conversation.generalUnreadCount > 0) && conversation.secretUnreadCount > 0
}

function ActionSheet({ title, actions, onClose }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-end', fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', padding: '0 8px calc(8px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
        <div style={{ background: WHITE, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontSize: 13, color: GRAY1, textAlign: 'center', borderBottom: '0.5px solid rgba(60,60,67,0.18)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              onClick={() => { onClose(); action.onSelect() }}
              style={{ width: '100%', border: 'none', borderTop: index ? '0.5px solid rgba(60,60,67,0.18)' : 'none', background: WHITE, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, color: action.color || '#FF3B30', fontFamily: FONT, cursor: 'pointer' }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} style={{ width: '100%', marginTop: 8, border: 'none', borderRadius: 14, background: WHITE, padding: 16, fontSize: 17, fontWeight: 600, color: '#007AFF', fontFamily: FONT, cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    </div>,
    document.body,
  )
}

// Ligne de la messagerie, identique pour un événement et une discussion
// privée. actions : [{ label, icon, color, onSelect }] proposées par un appui
// long et révélées par un balayage vers la gauche.
export default function ConversationRow({ conversation, isLast, onClick, actions = [], currentUserId }) {
  const isEvent = conversation.kind === 'event'
  const event = conversation.event ?? {}
  // Le canal secret n'existe pas pour la personne fêtée
  const canSeeSecret = isEvent && !!event.birthday_person_user_id && currentUserId !== event.birthday_person_user_id
  const generalUnread = isEvent ? conversation.generalUnreadCount || 0 : 0
  const secretUnread = canSeeSecret ? conversation.secretUnreadCount || 0 : 0
  const directUnread = isEvent ? 0 : conversation.unreadCount || 0
  const unread = generalUnread + secretUnread + directUnread > 0
  const preview = previewMessage(conversation.lastMessage?.content)
  const hasMessage = !!conversation.lastMessage?.id
  const subtitle = isEvent
    ? [formatEventDateTime(event.date), event.location?.trim()].filter(Boolean).join(' · ')
    : `${isOwnMessage(conversation.lastMessage, currentUserId) ? 'Toi : ' : ''}${preview.text}`

  const revealWidth = DELETE_REVEAL_WIDTH * actions.length
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const pointerRef = useRef(null)
  const suppressClickRef = useRef(false)
  const longPressRef = useRef(null)

  useEffect(() => () => clearTimeout(longPressRef.current), [])

  function cancelLongPress() {
    clearTimeout(longPressRef.current)
    longPressRef.current = null
  }

  function handlePointerDown(e) {
    pointerRef.current = { x: e.clientX, y: e.clientY, offset, active: true }
    suppressClickRef.current = false
    if (actions.length && offset === 0) {
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null
        suppressClickRef.current = true
        pointerRef.current = null
        navigator.vibrate?.(10)
        setShowActions(true)
      }, LONG_PRESS_MS)
    }
  }

  function handlePointerMove(e) {
    const pointer = pointerRef.current
    if (!pointer?.active) return
    const dx = e.clientX - pointer.x
    const dy = e.clientY - pointer.y
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    cancelLongPress()
    if (!revealWidth || (Math.abs(dy) > Math.abs(dx) && offset === 0)) return
    if (!dragging) e.currentTarget.setPointerCapture?.(e.pointerId)
    setOffset(Math.min(0, Math.max(-revealWidth, pointer.offset + dx)))
    setDragging(true)
    if (Math.abs(dx) > 8) suppressClickRef.current = true
  }

  function handlePointerUp() {
    cancelLongPress()
    if (!pointerRef.current) return
    pointerRef.current = null
    setOffset(current => (current < -revealWidth / 2 ? -revealWidth : 0))
    window.setTimeout(() => setDragging(false), 0)
  }

  function handleClick(e) {
    if (suppressClickRef.current || offset < 0) {
      e.preventDefault()
      setOffset(0)
      suppressClickRef.current = false
      return
    }
    onClick(isEvent ? initialEventChannelIsSecret(conversation, canSeeSecret) : undefined)
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: WHITE }}>
      {actions.length > 0 && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex' }}>
          {actions.map(action => (
            <button
              key={action.label}
              type="button"
              tabIndex={offset < 0 ? 0 : -1}
              onClick={e => { e.stopPropagation(); setOffset(0); action.onSelect() }}
              style={{ width: DELETE_REVEAL_WIDTH, border: 'none', background: action.swipeColor || '#FF3B30', color: WHITE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}
            >
              {action.swipeIcon}
              {action.swipeLabel || action.label}
            </button>
          ))}
        </div>
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={e => { if (actions.length) e.preventDefault() }}
        style={{ position: 'relative', transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.18s ease', touchAction: 'pan-y', background: WHITE, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <button
          type="button"
          onClick={handleClick}
          style={{ width: '100%', height: ROW_HEIGHT, border: 'none', background: WHITE, padding: `0 ${ROW_PADDING_X}px`, display: 'flex', alignItems: 'center', gap: ROW_GAP, textAlign: 'left', cursor: 'pointer', fontFamily: FONT, boxSizing: 'border-box' }}
        >
          <span style={{ position: 'relative', width: ROW_IMAGE_SIZE, height: ROW_IMAGE_SIZE, flexShrink: 0, display: 'block' }}>
            {isEvent
              ? <EventCover coverUrl={getCoverUrl(event.cover_image)} size={ROW_IMAGE_SIZE} />
              : <Avatar name={conversation.title} url={conversation.avatarUrl} size={ROW_IMAGE_SIZE} isCloseFriend={conversation.isCloseFriend} />}
          </span>

          <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <span style={{ minWidth: 0, fontSize: 16, lineHeight: '21px', fontWeight: unread ? 700 : 600, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conversation.title}
              </span>
              {conversation.isMuted && <BellOff size={13} strokeWidth={1.8} color={GRAY1} style={{ flexShrink: 0 }} />}
            </span>
            <span style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, lineHeight: '19px', color: GRAY1, minWidth: 0 }}>
              {!isEvent && preview.voice && <Mic size={14} strokeWidth={2} color={GRAY1} style={{ flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
            </span>
          </span>

          <span style={{ alignSelf: 'stretch', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 5 }}>
            <span style={{ fontSize: 13, lineHeight: '18px', minHeight: 18, color: GRAY1 }}>{hasMessage ? formatConvTime(conversation.lastAt) : ''}</span>
            <span style={{ display: 'flex', gap: 4, minHeight: 20 }}>
              {directUnread > 0 && <UnreadBadge variant="direct" count={directUnread} label={unreadLabel(directUnread)} />}
              {generalUnread > 0 && <UnreadBadge variant="general" count={generalUnread} label={unreadLabel(generalUnread, 'Général')} />}
              {secretUnread > 0 && <UnreadBadge variant="secret" count={secretUnread} label={unreadLabel(secretUnread, 'Secret')} />}
            </span>
          </span>
        </button>
        {!isLast && <RowSeparator />}
      </div>

      {showActions && <ActionSheet title={conversation.title} actions={actions} onClose={() => setShowActions(false)} />}
    </div>
  )
}

export function ConversationRowSkeleton({ isLast }) {
  return (
    <div style={{ position: 'relative', height: ROW_HEIGHT, padding: `0 ${ROW_PADDING_X}px`, display: 'flex', alignItems: 'center', gap: ROW_GAP, background: WHITE }}>
      <div style={{ width: ROW_IMAGE_SIZE, height: ROW_IMAGE_SIZE, borderRadius: '50%', background: BG, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: '55%', height: 15, borderRadius: 8, background: BG, marginBottom: 8 }} />
        <div style={{ width: '80%', height: 13, borderRadius: 7, background: BG }} />
      </div>
      {!isLast && <RowSeparator />}
    </div>
  )
}
