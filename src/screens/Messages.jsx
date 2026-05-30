import { useState, useEffect, useMemo, useRef } from 'react'
import { BellOff, Calendar as CalendarIcon, CalendarFold, ChevronLeft, Lock, MapPin, MessageCircle, Mic, MoreHorizontal, Plus, Search, Send, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriends } from '../lib/friendships'
import { findOrCreateDirectConversation } from '../lib/conversations'
import { useUnreadCounts } from '../hooks/useUnreadCounts'

const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'
const PAGE_BG = '#faf9fb'
const BG = '#F2F2F7'
const WHITE = '#FFFFFF'
const BLACK = '#1C1C1E'
const GRAY1 = '#8E8E93'
const GRAY2 = '#AEAEB2'
const CARD_SHADOW = '0 2px 16px rgba(0,0,0,0.08)'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
const DELETE_REVEAL_WIDTH = 86

const typeEmoji = {
  Anniversaire: '🎂',
  Apéro: '🥂',
  Dîner: '🍽️',
  Brunch: '🥐',
  Voyage: '✈️',
  Soirée: '🎉',
}

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function firstName(name) {
  return (name ?? 'Ami').trim().split(/\s+/)[0] || 'Ami'
}

function directProfileDisplayName(profile) {
  return profile?.first_name || profile?.name || profile?.email || 'Utilisateur'
}

function profileDisplayName(profile, fallback = 'Ami') {
  return profile?.first_name || profile?.name || profile?.email || fallback
}

function notificationConversationId(notification) {
  return notification?.data?.conversation_id || notification?.data?.direct_conversation_id
}

function getAvatarColor(name) {
  const colors = ['#F7B7C8', '#BFD7FF', '#BDEBD0', '#FFD8A8', '#D8C7FF', '#BDE7F0']
  let hash = 0
  for (let i = 0; i < (name || '').length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatConvTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (msgDay.getTime() === yesterday.getTime()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function formatEventDateTime(ts) {
  if (!ts) return 'Date à définir'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'Date à définir'
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
  const time = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} · ${time}`
}

const GROUP_INTERVAL_MS = 2 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a, b) {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  return startOfDay(da).getTime() === startOfDay(db).getTime()
}

function formatDateSeparator(ts) {
  const date = new Date(ts)
  const today = startOfDay(new Date())
  const msgDay = startOfDay(date)
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function formatEventHeaderDate(ts) {
  if (!ts) return 'Date à définir'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'Date à définir'
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  const day = d.getDate()
  const month = d.toLocaleDateString('fr-FR', { month: 'long' })
  const h = d.getHours()
  const m = d.getMinutes()
  const time = m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
  return `${weekday} ${day} ${month} · ${time}`
}

function buildEventMessageRows(messages, currentUserId) {
  return messages.flatMap((msg, index) => {
    const previous = messages[index - 1]
    const next = messages[index + 1]
    const isSystem = Boolean(msg.event)
    const showDate = index === 0 || !isSameDay(previous?.created_at, msg.created_at)
    const rows = []

    if (showDate) {
      rows.push({ id: `date-${msg.id}`, type: 'date', label: formatDateSeparator(msg.created_at) })
    }

    if (isSystem) {
      rows.push({ id: msg.id, type: 'system', message: msg })
      return rows
    }

    const prevGroupable = previous && !previous.event
      && previous.user_id === msg.user_id
      && Math.abs(new Date(msg.created_at) - new Date(previous.created_at)) < GROUP_INTERVAL_MS
    const nextGroupable = next && !next.event
      && next.user_id === msg.user_id
      && Math.abs(new Date(next.created_at) - new Date(msg.created_at)) < GROUP_INTERVAL_MS

    rows.push({
      id: msg.id,
      type: 'message',
      message: msg,
      isMine: msg.user_id === currentUserId,
      compactTop: Boolean(prevGroupable),
      showName: msg.user_id !== currentUserId && !prevGroupable,
      showAvatar: msg.user_id !== currentUserId && !nextGroupable,
    })

    return rows
  })
}

function readSeen(key) {
  if (typeof window === 'undefined') return 0
  const value = window.localStorage.getItem(key)
  return value ? new Date(value).getTime() : 0
}

function writeSeen(key) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, new Date().toISOString())
}

function channelLastReadKey(eventId, isSecret) {
  return `lastRead_${eventId}_${isSecret}`
}

function readChannelLastRead(eventId, isSecret) {
  return readSeen(channelLastReadKey(eventId, isSecret))
}

function writeChannelLastRead(eventId, isSecret) {
  if (!eventId) return
  writeSeen(channelLastReadKey(eventId, isSecret))
}

function hiddenConversationsKey(userId) {
  return `hidden_conversations_${userId}`
}

function readHiddenConversations(userId) {
  if (typeof window === 'undefined' || !userId) return {}
  try {
    return JSON.parse(window.localStorage.getItem(hiddenConversationsKey(userId)) || '{}')
  } catch {
    return {}
  }
}

function writeHiddenConversations(userId, hidden) {
  if (typeof window === 'undefined' || !userId) return
  window.localStorage.setItem(hiddenConversationsKey(userId), JSON.stringify(hidden))
}

function isConversationHidden(conversation, hiddenConversations) {
  const hiddenAt = hiddenConversations[conversation.id]
  if (!hiddenAt) return false
  const hiddenTime = new Date(hiddenAt).getTime()
  const lastTime = new Date(conversation.lastAt || 0).getTime()
  return !lastTime || lastTime <= hiddenTime
}

async function fetchProfilesByIds(ids) {
  if (!ids.length) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, name, first_name, avatar_url, email')
    .in('id', ids)

  return data ?? []
}

async function enrichMessagesWithProfiles(rows = []) {
  const userIds = [...new Set(rows.map(message => message.user_id).filter(Boolean))]
  const profiles = await fetchProfilesByIds(userIds)
  const profilesById = Object.fromEntries(profiles.map(profile => [profile.id, profile]))
  return rows.map(message => ({
    ...message,
    profile: message.profiles ?? profilesById[message.user_id] ?? null,
  }))
}

function parseVoice(content) {
  const match = String(content || '').match(/^\[voice:(\d+):(\d+)\]/)
  if (!match) return null
  return `${Number(match[1])}:${String(match[2]).padStart(2, '0')}`
}

function previewMessage(content) {
  const duration = parseVoice(content)
  if (duration) return { voice: true, text: `Message vocal · ${duration}` }
  return { voice: false, text: content || 'Aucun message' }
}

function Avatar({ name, url, size = 50 }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
  }
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

function IconButton({ children, gradient = false, label, onClick }) {
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

function SkeletonRow({ isLast }) {
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

function EmptyState({ activeTab, onNewMessage }) {
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

function NewMessageSheet({ friends, loading, onClose, onSelectFriend }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        background: 'rgba(28,28,30,0.20)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '72%',
          background: WHITE,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 28px rgba(0,0,0,0.16)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: BLACK }}>Nouveau message</div>
            <div style={{ marginTop: 2, fontSize: 13, color: GRAY1 }}>Choisis un ami pour démarrer une conversation</div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={17} strokeWidth={2.2} color={BLACK} />
          </button>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            [0, 1, 2].map(item => <SkeletonRow key={item} isLast={item === 2} />)
          ) : friends.length === 0 ? (
            <div style={{ padding: 24, color: GRAY1, fontSize: 14, textAlign: 'center' }}>
              Aucun ami disponible pour le moment
            </div>
          ) : friends.map((friend, index) => (
            <div key={friend.friend_id}>
              <button
                type="button"
                onClick={() => onSelectFriend(friend)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: WHITE,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                <Avatar name={friend.friend_name} url={friend.friend_avatar} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 650, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {friend.friend_name || 'Ami'}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 13, color: GRAY1 }}>Envoyer un message</div>
                </div>
              </button>
              {index !== friends.length - 1 && <div style={{ marginLeft: 74, height: 0.5, background: 'rgba(0,0,0,0.08)' }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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

function ChannelPreview({ type, message, unreadCount = 0, onClick }) {
  const isSecretChannel = type === 'secret'
  const preview = previewMessage(message?.content)
  const secretUnread = isSecretChannel && unreadCount > 0
  const accent = secretUnread ? '#7c5cbf' : BLACK

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        border: secretUnread ? '1px solid #7c5cbf44' : '1px solid rgba(28,28,30,0.07)',
        borderRadius: 12,
        background: secretUnread ? '#7c5cbf0d' : '#F8F8FA',
        padding: '10px 11px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: FONT,
        position: 'relative',
      }}
    >
      {isSecretChannel ? (
        <Lock size={16} strokeWidth={2.2} color={secretUnread ? '#7c5cbf' : GRAY1} style={{ flexShrink: 0 }} />
      ) : (
        <MessageCircle size={16} strokeWidth={2} color={BLACK} style={{ flexShrink: 0 }} />
      )}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 700,
          color: isSecretChannel ? accent : BLACK,
          lineHeight: 1.2,
        }}>
          {isSecretChannel ? 'Secret' : 'Général'}
        </span>
        <span style={{
          display: 'block',
          marginTop: 2,
          fontSize: 11,
          color: isSecretChannel ? (secretUnread ? '#7c5cbf' : GRAY1) : GRAY1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.25,
        }}>
          {preview.text}
        </span>
      </span>
      {secretUnread && (
        <span style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#7c5cbf',
          boxShadow: '0 0 0 2px #fff',
        }} />
      )}
    </button>
  )
}

function EventConversationCard({ conversation, onOpenChannel }) {
  const event = conversation.event ?? {}

  return (
    <div style={{
      background: WHITE,
      borderRadius: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      <div
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #e055aa14, #f5a62314)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
          fontFamily: FONT,
        }}
      >
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: GRADIENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <CalendarFold size={20} strokeWidth={2.2} color={WHITE} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversation.title}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: GRAY1, minWidth: 0 }}>
            <CalendarIcon size={12} strokeWidth={1.9} color={GRAY1} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatEventDateTime(event.date)}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 14px 12px', display: 'flex', gap: 8 }}>
        <ChannelPreview
          type="general"
          message={conversation.generalMessage}
          unreadCount={conversation.generalUnreadCount || 0}
          onClick={() => onOpenChannel(false)}
        />
        <ChannelPreview
          type="secret"
          message={conversation.secretMessage}
          unreadCount={conversation.secretUnreadCount || 0}
          onClick={() => onOpenChannel(true)}
        />
      </div>
    </div>
  )
}

function ConversationRow({ conversation, isLast, onClick, onDelete }) {
  const unread = conversation.unreadCount > 0
  const preview = previewMessage(conversation.lastMessage?.content)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const pointerRef = useRef(null)
  const suppressClickRef = useRef(false)

  function handlePointerDown(event) {
    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      offset,
      active: true,
    }
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
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: '#FF3B30',
      borderRadius: 20,
      boxShadow: CARD_SHADOW,
      marginBottom: 10,
    }}>
      <button
        type="button"
        aria-label={`Supprimer ${conversation.title}`}
        onClick={handleDelete}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: DELETE_REVEAL_WIDTH,
          border: 'none',
          background: '#FF3B30',
          color: WHITE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 750,
          fontFamily: FONT,
          cursor: 'pointer',
        }}
      >
        <Trash2 size={18} strokeWidth={2.2} color={WHITE} />
        Supprimer
      </button>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.18s ease',
          touchAction: 'pan-y',
          background: WHITE,
          borderRadius: 20,
        }}
      >
        <button
          type="button"
          onClick={handleClick}
          style={{
            width: '100%',
            border: 'none',
            background: WHITE,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: FONT,
            borderRadius: 20,
            minHeight: 82,
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {conversation.kind === 'event' ? (
              <EventAvatar emoji={conversation.emoji} size={56} />
            ) : (
              <Avatar name={conversation.title} url={conversation.avatarUrl} size={56} />
            )}
            {unread && (
              <div style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 22,
                height: 22,
                padding: '0 6px',
                borderRadius: 11,
                background: GRADIENT,
                border: `2px solid ${WHITE}`,
                color: WHITE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                lineHeight: 1,
              }}>
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                flex: 1,
                minWidth: 0,
                fontSize: 17,
                fontWeight: 800,
                color: BLACK,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {conversation.title}
              </div>
              {conversation.isMuted && <BellOff size={14} strokeWidth={1.8} color={GRAY2} />}
              <div style={{ fontSize: 14, color: GRAY2, flexShrink: 0 }}>{formatConvTime(conversation.lastAt)}</div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 15,
              color: unread ? BLACK : GRAY1,
              fontWeight: unread ? 800 : 400,
              minWidth: 0,
            }}>
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

export default function Messages({ event, onBack, onEventOpen, onDirectConvOpen, notifications = [], markAsRead }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState(null)
  const [isSecret, setIsSecret] = useState(false)
  const [birthdayPersonProfile, setBirthdayPersonProfile] = useState(null)
  const bottomRef = useRef(null)

  const [myRsvpStatus, setMyRsvpStatus] = useState(null)
  const [conversations, setConversations] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [hiddenConversations, setHiddenConversations] = useState({})
  const appOpenedAtRef = useRef(null)
  const messageNotificationVersion = notifications.filter(n => n.type === 'message_received' && !n.read).length
  const { unreadByConversation, totalUnread: unreadTotal } = useUnreadCounts(userId)
  const user = userId ? { id: userId } : null
  const canUseSecretChannel = !!event?.birthday_person_user_id && !!userId && userId !== event.birthday_person_user_id
  const birthdayPersonFirstName =
    event?.birthdayFirstName ||
    event?.birthday_person?.first_name ||
    event?.birthdayPerson?.first_name ||
    birthdayPersonProfile?.first_name ||
    (birthdayPersonProfile?.name ? firstName(birthdayPersonProfile.name) : null) ||
    'La personne fêtée'

  useEffect(() => {
    if (typeof window !== 'undefined' && !appOpenedAtRef.current) {
      appOpenedAtRef.current = window.localStorage.getItem('last_app_opened_at') || new Date(0).toISOString()
      window.localStorage.setItem('last_app_opened_at', new Date().toISOString())
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        setHiddenConversations(readHiddenConversations(user.id))
      }
    })
  }, [])

  useEffect(() => {
    if (!event?.id) return
    writeSeen(`last_seen_event_${event.id}`)
    writeChannelLastRead(event.id, isSecret)
    const unreadIds = notifications
      .filter(n => n.type === 'message_received' && !n.read && n.data?.event_id === event.id)
      .map(n => n.id)
    unreadIds.forEach(id => markAsRead?.(id))
    fetchMessages()
  }, [event?.id, isSecret])

  useEffect(() => {
    if (!event?.id) return
    setIsSecret(event.initialIsSecret === true)
    setBirthdayPersonProfile(null)
  }, [event?.id, event?.initialIsSecret])

  useEffect(() => {
    if (!event?.birthday_person_user_id) {
      setBirthdayPersonProfile(null)
      return
    }
    if (event?.birthdayFirstName || event?.birthday_person?.first_name || event?.birthdayPerson?.first_name) return

    let cancelled = false
    supabase
      .from('profiles')
      .select('id, name, first_name')
      .eq('id', event.birthday_person_user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setBirthdayPersonProfile(data ?? null)
      })

    return () => { cancelled = true }
  }, [event?.birthday_person_user_id, event?.birthdayFirstName, event?.birthday_person?.first_name, event?.birthdayPerson?.first_name])

  useEffect(() => {
    if (!canUseSecretChannel && isSecret) setIsSecret(false)
  }, [canUseSecretChannel, isSecret])

  useEffect(() => {
    if (!event?.id || !userId) { setMyRsvpStatus(null); return undefined }
    let cancelled = false
    supabase
      .from('rsvps')
      .select('status')
      .eq('event_id', event.id)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setMyRsvpStatus(data?.status ?? null) })
    return () => { cancelled = true }
  }, [event?.id, userId])

  useEffect(() => {
    if (!event?.id || !userId) return undefined

    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`messages:${event.id}:${isSecret ? 'secret' : 'general'}:${suffix}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `is_secret=eq.${isSecret}`,
        },
        async (payload) => {
          if (payload.new.event_id !== event.id) return
          const { data, error } = await supabase
            .from('messages')
            .select('*, profiles(id, name, first_name, avatar_url)')
            .eq('id', payload.new.id)
            .eq('is_secret', isSecret)
            .single()

          let message = null
          if (error) {
            const fallback = await supabase
              .from('messages')
              .select('*')
              .eq('id', payload.new.id)
              .eq('is_secret', isSecret)
              .single()
            if (!fallback.data) return
            const enriched = await enrichMessagesWithProfiles([fallback.data])
            message = enriched[0]
          } else {
            message = { ...data, profile: data.profiles ?? null }
          }
          if (!message) return

          setMessages(prev => {
            if (prev.find(m => m.id === message.id)) return prev
            const withoutOptimistic = prev.filter(m => !(m.isOptimistic && m.user_id === message.user_id && m.content === message.content))
            return [...withoutOptimistic, message]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [event?.id, userId, isSecret])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (event || !userId) return
    fetchAll()
  }, [event, userId, messageNotificationVersion])

  useEffect(() => {
    if (event || !userId) return undefined

    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`messages-list:${userId}:${suffix}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        () => fetchAll()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [event, userId])

  async function fetchAll() {
    setListLoading(true)
    setFriendsLoading(true)
    const friendRows = await getFriends(userId)
    const convRows = await fetchConversations(friendRows.data ?? [])
    setConversations(convRows)
    setFriends(friendRows.data ?? [])
    setListLoading(false)
    setFriendsLoading(false)
  }

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(id, name, first_name, avatar_url)')
      .eq('event_id', event.id)
      .eq('is_secret', isSecret)
      .order('created_at', { ascending: true })
    if (error) {
      const fallback = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', event.id)
        .eq('is_secret', isSecret)
        .order('created_at', { ascending: true })
      if (fallback.error || !fallback.data) {
        console.error('[Messages] fetch messages error:', error, fallback.error)
        return
      }
      setMessages(await enrichMessagesWithProfiles(fallback.data))
      return
    }
    if (!data) return

    setMessages(await enrichMessagesWithProfiles(data))
  }

  async function fetchEventConversations() {
    const [rsvpResult, { data: ownRows }] = await Promise.all([
      supabase.from('rsvps').select('event_id, last_read_at').eq('user_id', userId),
      supabase.from('events').select('id').eq('user_id', userId),
    ])
    let rsvpRows = rsvpResult.data ?? []
    if (rsvpResult.error) {
      const fallback = await supabase.from('rsvps').select('event_id').eq('user_id', userId)
      rsvpRows = fallback.data ?? []
    }

    const allIds = [...new Set([
      ...(rsvpRows?.map(r => r.event_id) ?? []),
      ...(ownRows?.map(e => e.id) ?? []),
    ])]

    if (!allIds.length) return []

    const [{ data: eventsData }, { data: msgs }] = await Promise.all([
      supabase.from('events').select('id, name, emoji, type, date, birthday_person_user_id').in('id', allIds),
      supabase.from('messages').select('id, event_id, content, created_at, user_id, is_secret').in('event_id', allIds).order('created_at', { ascending: false }).limit(500),
    ])

    const lastByEvent = {}
    const generalLastByEvent = {}
    const secretLastByEvent = {}
    const generalUnreadByEvent = {}
    const secretUnreadByEvent = {}
    const lastReadByEvent = Object.fromEntries((rsvpRows ?? []).map(row => [row.event_id, row.last_read_at]))
    ;(msgs ?? []).forEach(message => {
      if (!lastByEvent[message.event_id]) lastByEvent[message.event_id] = message
      if (message.is_secret && !secretLastByEvent[message.event_id]) secretLastByEvent[message.event_id] = message
      if (!message.is_secret && !generalLastByEvent[message.event_id]) generalLastByEvent[message.event_id] = message
      const dbSeenAt = lastReadByEvent[message.event_id]
        ? new Date(lastReadByEvent[message.event_id]).getTime()
        : 0
      const channelSeenAt = Math.max(dbSeenAt, readChannelLastRead(message.event_id, message.is_secret))
      const seenAt = channelSeenAt || (message.is_secret ? 0 : readSeen(`last_seen_event_${message.event_id}`))
      if (message.user_id !== userId && new Date(message.created_at).getTime() > seenAt) {
        if (message.is_secret) {
          secretUnreadByEvent[message.event_id] = (secretUnreadByEvent[message.event_id] || 0) + 1
        } else {
          generalUnreadByEvent[message.event_id] = (generalUnreadByEvent[message.event_id] || 0) + 1
        }
      }
    })

    return (eventsData ?? [])
      .filter(ev => lastByEvent[ev.id])
      .map(ev => {
        const generalUnreadCount = generalUnreadByEvent[ev.id] || 0
        const secretUnreadCount = secretUnreadByEvent[ev.id] || 0
        return {
          id: `event-${ev.id}`,
          kind: 'event',
          event: ev,
          eventId: ev.id,
          title: ev.name || 'Événement',
          emoji: ev.emoji || typeEmoji[ev.type] || '🎉',
          lastMessage: lastByEvent[ev.id],
          generalMessage: generalLastByEvent[ev.id] || null,
          secretMessage: secretLastByEvent[ev.id] || null,
          lastAt: lastByEvent[ev.id]?.created_at,
          unreadCount: generalUnreadCount + secretUnreadCount,
          generalUnreadCount,
          secretUnreadCount,
        }
      })
  }

  async function fetchDirectConversations(friendRows = []) {
    let { data: myParticipants, error: participantsError } = await supabase
      .from('direct_conversation_participants')
      .select('conversation_id, is_muted, direct_conversations(created_at)')
      .eq('user_id', userId)

    if (participantsError) {
      const fallback = await supabase
        .from('direct_conversation_participants')
        .select('conversation_id, direct_conversations(created_at)')
        .eq('user_id', userId)
      myParticipants = fallback.data
    }

    const convIds = (myParticipants ?? []).map(row => row.conversation_id)
    if (!convIds.length) return []

    const [{ data: otherParticipants }, { data: directMessages }] = await Promise.all([
      supabase.rpc('get_conversation_other_participants', { conv_ids: convIds }),
      supabase.from('direct_messages').select('id, conversation_id, content, created_at, sender_id').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(500),
    ])

    const otherByConv = {}
    ;(otherParticipants ?? []).forEach(row => {
      otherByConv[row.conversation_id] = row.other_user_id
    })

    const otherIds = [...new Set(Object.values(otherByConv).filter(Boolean))]
    const profiles = await fetchProfilesByIds(otherIds)
    const profileById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
    const friendById = Object.fromEntries((friendRows ?? []).map(friend => [friend.friend_id, friend]))

    const lastByConv = {}
    ;(directMessages ?? []).forEach(message => {
      if (!lastByConv[message.conversation_id]) lastByConv[message.conversation_id] = message
    })

    const participantByConv = Object.fromEntries((myParticipants ?? []).map(row => [row.conversation_id, row]))
    return convIds.map(conversationId => {
      const otherUserId = otherByConv[conversationId]
      const profile = profileById[otherUserId] ?? null
      const friend = friendById[otherUserId]
      const displayName = directProfileDisplayName(profile)
      const createdAt = participantByConv[conversationId]?.direct_conversations?.created_at
      return {
        id: `dm-${conversationId}`,
        kind: 'direct',
        conversationId,
        friend: {
          friend_id: profile?.id || friend?.friend_id || otherUserId,
          friend_name: displayName,
          friend_avatar: profile?.avatar_url || friend?.friend_avatar || '',
        },
        title: displayName,
        avatarUrl: profile?.avatar_url || friend?.friend_avatar || '',
        lastMessage: lastByConv[conversationId] || { content: 'Aucun message', created_at: createdAt },
        lastAt: lastByConv[conversationId]?.created_at || createdAt,
        unreadCount: 0,
        isMuted: participantByConv[conversationId]?.is_muted === true,
      }
    })
  }

  async function fetchConversations(friendRows = []) {
    const [eventRows, directRows] = await Promise.all([
      fetchEventConversations(),
      fetchDirectConversations(friendRows),
    ])
    return [...eventRows, ...directRows].sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
  }

  const conversationsByFriendId = useMemo(() => {
    const map = new Map()
    conversations.filter(conv => conv.kind === 'direct' && !isConversationHidden(conv, hiddenConversations)).forEach(conv => {
      if (conv.friend?.friend_id) map.set(conv.friend.friend_id, conv)
    })
    return map
  }, [conversations, hiddenConversations])

  const inboxConversations = conversations.filter(conv => !isConversationHidden(conv, hiddenConversations))

  const visibleConversations = inboxConversations.filter(conv => {
    if (activeTab === 'events') return conv.kind === 'event'
    if (activeTab === 'directs') return conv.kind === 'direct'
    if (activeTab === 'unread') return conv.unreadCount > 0
    return true
  })

  const eventMessageRows = useMemo(
    () => buildEventMessageRows(messages, userId),
    [messages, userId]
  )

  function hideConversation(conversation) {
    setHiddenConversations(prev => {
      const next = { ...prev, [conversation.id]: new Date().toISOString() }
      writeHiddenConversations(userId, next)
      return next
    })
  }

  function showConversation(conversationId) {
    setHiddenConversations(prev => {
      if (!prev[conversationId]) return prev
      const next = { ...prev }
      delete next[conversationId]
      writeHiddenConversations(userId, next)
      return next
    })
  }

  async function openFriend(friend) {
    if (!userId || !friend?.friend_id) return
    const { id, error } = await findOrCreateDirectConversation(userId, friend.friend_id)
    if (error) {
      console.error('[Messages] direct conversation error:', error)
      return
    }
    showConversation(`dm-${id}`)
    writeSeen(`last_seen_dm_${id}`)
    setShowNewMessage(false)
    onDirectConvOpen?.({ conversationId: id, friend })
  }

  function openNewMessage() {
    if (!friendsLoading) setShowNewMessage(true)
  }

  async function handleConversationTap(conv, secretChannel = false) {
    if (conv.kind === 'event') {
      writeSeen(`last_seen_event_${conv.eventId}`)
      writeChannelLastRead(conv.eventId, secretChannel)
      const unreadIds = notifications
        .filter(n => n.type === 'message_received' && !n.read && n.data?.event_id === conv.eventId)
        .map(n => n.id)
      for (const id of unreadIds) markAsRead?.(id)
      onEventOpen?.({ ...conv.event, initialIsSecret: secretChannel })
      return
    }
    writeSeen(`last_seen_dm_${conv.conversationId}`)
    const unreadIds = notifications
      .filter(n => n.type === 'message_received' && !n.read && notificationConversationId(n) === conv.conversationId)
      .map(n => n.id)
    for (const id of unreadIds) markAsRead?.(id)
    onDirectConvOpen?.({ conversationId: conv.conversationId, friend: conv.friend })
  }

  async function send() {
    if (!input.trim() || !userId || !event?.id) return
    const content = input.trim()
    const optimistic = {
      id: crypto.randomUUID(),
      event_id: event.id,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      profile: null,
      is_secret: isSecret,
      isOptimistic: true,
    }
    setInput('')
    setMessages(prev => [...prev, optimistic])
    const { error } = await supabase.from('messages').insert({ event_id: event.id, user_id: userId, content, is_secret: isSecret })
    if (error) {
      setMessages(prev => prev.filter(message => message.id !== optimistic.id))
      console.log('Erreur Supabase:', JSON.stringify(error))
      return
    }
    if (isSecret) return
    const { error: notifErr } = await supabase.rpc('notify_message_recipients', {
      p_event_id:  event.id,
      p_sender_id: userId,
      p_title:     `Nouveau message dans ${event.name ?? 'un événement'}`,
      p_body:      content.length > 40 ? content.slice(0, 40) + '…' : content,
    })
    if (notifErr) console.error('[Notif] rpc error:', notifErr)
  }

  function formatTime(ts) {
    const d = new Date(ts)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  if (!event) {
    const tabs = [
      { id: 'all', label: 'Tous' },
      { id: 'events', label: 'Événements 🎉' },
      { id: 'directs', label: 'Directs' },
      { id: 'unread', label: 'Non lus', badge: unreadTotal },
    ]

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: PAGE_BG, overflow: 'hidden', fontFamily: FONT }}>
        <div style={{ padding: '18px 16px 10px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.1, fontWeight: 800, color: BLACK, letterSpacing: 0 }}>
                Messages
              </h1>
              <div style={{ marginTop: 4, fontSize: 13, color: GRAY1 }}>
                {unreadTotal} non lu{unreadTotal > 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconButton label="Rechercher"><Search size={17} strokeWidth={2.2} color={BLACK} /></IconButton>
              <IconButton label="Composer" gradient onClick={openNewMessage}><Plus size={22} strokeWidth={2} color={WHITE} /></IconButton>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 90 }}>
          <section style={{ padding: '8px 16px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GRAY1, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 }}>
              AMIS
            </div>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6, scrollbarWidth: 'none' }}>
              {friendsLoading ? (
                [0, 1, 2, 3].map(item => <div key={item} style={{ width: 58, height: 68, flexShrink: 0, borderRadius: 16, background: 'rgba(255,255,255,0.7)' }} />)
              ) : friends.length === 0 ? (
                <div style={{ fontSize: 13, color: GRAY1, padding: '8px 0 12px' }}>Aucun ami pour l'instant</div>
              ) : friends.map(friend => {
                const conv = conversationsByFriendId.get(friend.friend_id)
                const openedAt = new Date(appOpenedAtRef.current || 0).getTime()
                const hasFreshMessages = conv?.lastMessage?.sender_id !== userId && new Date(conv?.lastAt || 0).getTime() > openedAt
                return (
                  <button
                    key={friend.friend_id}
                    type="button"
                    onClick={() => openFriend(friend)}
                    style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 58, flexShrink: 0, cursor: 'pointer', fontFamily: FONT }}
                  >
                    <div style={{ padding: 2, borderRadius: '50%', background: hasFreshMessages ? GRADIENT : '#E5E5EA' }}>
                      <div style={{ padding: 2, borderRadius: '50%', background: BG }}>
                        <Avatar name={friend.friend_name} url={friend.friend_avatar} size={48} />
                      </div>
                    </div>
                    <span style={{ maxWidth: 58, fontSize: 11, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {firstName(friend.friend_name)}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section style={{ padding: '14px 16px 0' }}>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {tabs.map(tab => {
                const isActive = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      border: 'none',
                      borderRadius: 20,
                      background: isActive ? GRADIENT : WHITE,
                      color: isActive ? WHITE : BLACK,
                      padding: '8px 14px',
                      minHeight: 34,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                      boxShadow: isActive ? '0 2px 8px rgba(224,85,170,0.20)' : 'none',
                      fontFamily: FONT,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                    {tab.badge > 0 && (
                      <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: '#FF3B30', color: WHITE, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section style={{ padding: '12px 16px 0' }}>
            {listLoading ? (
              <div>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow isLast />
              </div>
            ) : visibleConversations.length === 0 ? (
              <EmptyState activeTab={activeTab} onNewMessage={openNewMessage} />
            ) : (
              <div>
                {visibleConversations.map((conv, index) => (
                  conv.kind === 'event' ? (
                    <EventConversationCard
                      key={conv.id}
                      conversation={conv}
                      onOpenChannel={secretChannel => handleConversationTap(conv, secretChannel)}
                    />
                  ) : (
                    <ConversationRow
                      key={conv.id}
                      conversation={{
                        ...conv,
                        unreadCount: unreadByConversation.get(conv.conversationId) ?? 0,
                      }}
                      isLast={index === visibleConversations.length - 1}
                      onClick={() => handleConversationTap(conv)}
                      onDelete={() => hideConversation(conv)}
                    />
                  )
                ))}
              </div>
            )}
          </section>
        </div>
        {showNewMessage && (
          <NewMessageSheet
            friends={friends}
            loading={friendsLoading}
            onClose={() => setShowNewMessage(false)}
            onSelectFriend={openFriend}
          />
        )}
      </div>
    )
  }

  const rsvpPill = myRsvpStatus === 'going'
    ? { label: 'Présent ✓', bg: 'rgba(52,199,89,0.22)', color: '#fff' }
    : myRsvpStatus === 'declined'
      ? { label: 'Décliné', bg: 'rgba(255,59,48,0.22)', color: '#fff' }
      : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: FONT }}>

      {/* Gradient header */}
      <div style={{
        background: 'linear-gradient(160deg, #e055aa 0%, #f5a623 100%)',
        flexShrink: 0,
        paddingBottom: 14,
      }}>
        {/* Top row: back + more */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, padding: 0,
            }}
          >
            <ChevronLeft size={18} color={WHITE} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label="Plus d'options"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, padding: 0,
            }}
          >
            <MoreHorizontal size={18} color={WHITE} strokeWidth={2.5} />
          </button>
        </div>

        {/* Emoji + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 16px 0' }}>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, marginBottom: 8,
          }}>
            {event.emoji || '🎉'}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: WHITE, textAlign: 'center', lineHeight: 1.2 }}>
            {event.name}
          </div>
        </div>

        {/* Info pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 16px 0' }}>
          <div style={{
            background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '5px 11px',
            fontSize: 12, color: WHITE, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}>
            <CalendarIcon size={12} strokeWidth={2} color={WHITE} />
            {formatEventHeaderDate(event.date)}
          </div>
          {event.location && (
            <div style={{
              background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '5px 11px',
              fontSize: 12, color: WHITE, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
              maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <MapPin size={12} strokeWidth={2} color={WHITE} />
              {event.location}
            </div>
          )}
          {rsvpPill && (
            <div style={{
              background: rsvpPill.bg, borderRadius: 20, padding: '5px 11px',
              fontSize: 12, color: rsvpPill.color, fontWeight: 700, flexShrink: 0,
            }}>
              {rsvpPill.label}
            </div>
          )}
        </div>

        {/* General / Secret channel switcher */}
        {canUseSecretChannel && (
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 16, background: 'rgba(255,255,255,0.18)' }}>
              <button
                type="button"
                onClick={() => setIsSecret(false)}
                style={{
                  flex: 1, minHeight: 32, border: 'none', borderRadius: 13,
                  background: !isSecret ? 'rgba(255,255,255,0.90)' : 'transparent',
                  color: !isSecret ? BLACK : 'rgba(255,255,255,0.85)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer',
                }}
              >
                <MessageCircle size={13} strokeWidth={2} />
                Général
              </button>
              <button
                type="button"
                onClick={() => setIsSecret(true)}
                style={{
                  flex: 1, minHeight: 32, border: 'none', borderRadius: 13,
                  background: isSecret ? 'rgba(255,255,255,0.90)' : 'transparent',
                  color: isSecret ? '#534AB7' : 'rgba(255,255,255,0.85)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer',
                }}
              >
                <Lock size={13} strokeWidth={2.2} />
                Secret
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Secret channel notice */}
      {isSecret && (
        <div style={{
          background: '#EEEDFE', color: '#534AB7',
          padding: '9px 14px', display: 'flex', alignItems: 'center',
          gap: 7, fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          <Lock size={14} strokeWidth={2.2} color="#534AB7" />
          {birthdayPersonFirstName} ne peut pas voir ces messages
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: GRAY1, fontSize: 14, marginTop: 40 }}>
            Aucun message pour l'instant
          </div>
        ) : (
          eventMessageRows.map(row => {
            if (row.type === 'date') {
              return (
                <div
                  key={row.id}
                  style={{ textAlign: 'center', color: GRAY1, fontSize: 11, fontWeight: 600, margin: '12px 0 4px' }}
                >
                  {row.label}
                </div>
              )
            }

            if (row.type === 'system') {
              const { message: sm } = row
              return (
                <div key={sm.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <div style={{
                    background: 'rgba(0,122,255,0.09)', color: '#007AFF',
                    borderRadius: 14, padding: '5px 14px',
                    fontSize: 12, fontWeight: 600, textAlign: 'center', maxWidth: '82%',
                  }}>
                    {sm.content || 'Mise à jour'}
                  </div>
                </div>
              )
            }

            const { message: msg, isMine, compactTop, showName, showAvatar } = row
            const senderName = profileDisplayName(msg.profile)

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                  marginTop: compactTop ? 2 : 10,
                }}
              >
                {!isMine && showName && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: GRAY1,
                    marginBottom: 3, paddingLeft: 36,
                  }}>
                    {senderName}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '78%' }}>
                  {!isMine && (
                    showAvatar
                      ? <Avatar name={senderName} url={msg.profile?.avatar_url} size={28} />
                      : <div style={{ width: 28, flexShrink: 0 }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      padding: '9px 13px',
                      borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMine ? GRADIENT : WHITE,
                      color: isMine ? WHITE : BLACK,
                      fontSize: 14, lineHeight: 1.4,
                      wordBreak: 'break-word',
                      opacity: msg.isOptimistic ? 0.7 : 1,
                      boxShadow: isMine ? 'none' : '0 1px 6px rgba(0,0,0,0.08)',
                    }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: 10, color: GRAY1, marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '10px 14px 20px', background: WHITE,
        display: 'flex', gap: 9, alignItems: 'center',
        flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 20, background: BG,
            fontSize: 14, color: BLACK, border: 'none', outline: 'none', fontFamily: FONT,
          }}
        />
        <button
          type="button"
          aria-label="Envoyer"
          onClick={send}
          style={{
            width: 32, height: 32,
            background: input.trim() ? GRADIENT : '#D1D1D6',
            borderRadius: '50%', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'default',
            transition: 'background 0.15s', flexShrink: 0, padding: 0,
          }}
        >
          <Send size={14} color={WHITE} fill={WHITE} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
