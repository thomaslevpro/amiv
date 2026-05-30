import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import { supabase } from '../lib/supabase'

dayjs.extend(relativeTime)
dayjs.locale('fr')

const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'
const AVATAR_COLORS = ['#FBBF9A', '#7c5cbf', '#4D96FF', '#FF6B9D', '#34C759', '#FFD93D']
const FILTERS = [
  { key: 'all', label: 'Tout', types: null },
  { key: 'events', label: 'Événements', types: ['rsvp_received', 'event_invitation'] },
  { key: 'messages', label: 'Messages', types: ['message_received'] },
  { key: 'friends', label: 'Amis', types: ['friend_request', 'friend_accepted', 'birthday_reminder'] },
]

function avatarColor(id = '') {
  const hash = String(id).slice(0, 6).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function displayName(profile) {
  return profile?.first_name || profile?.name || '?'
}

function initials(profile) {
  return displayName(profile).charAt(0).toUpperCase()
}

function relativeLabel(createdAt) {
  const date = dayjs(createdAt)
  if (!date.isValid()) return ''
  const diffHours = dayjs().diff(date, 'hour')
  if (diffHours >= 20 && diffHours < 36) return 'hier'
  return date.fromNow()
}

function bucketNotifications(notifications) {
  const now = Date.now()
  return notifications.reduce((groups, notification) => {
    const age = now - new Date(notification.created_at).getTime()
    if (!notification.read) groups.new.push(notification)
    else if (age < 24 * 60 * 60 * 1000) groups.today.push(notification)
    else if (age < 7 * 24 * 60 * 60 * 1000) groups.week.push(notification)
    else groups.earlier.push(notification)
    return groups
  }, { new: [], today: [], week: [], earlier: [] })
}

async function enrichNotification(notification) {
  const eventId = notification?.data?.event_id
  const senderId = notification?.data?.sender_id
  const [eventRes, senderRes] = await Promise.all([
    eventId
      ? supabase.from('events').select('id, name, emoji, birthday_person_user_id').eq('id', eventId).maybeSingle()
      : Promise.resolve({ data: null }),
    senderId
      ? supabase.from('profiles').select('id, first_name, name, avatar_url').eq('id', senderId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return {
    ...notification,
    event: eventRes.data ?? null,
    sender: senderRes.data ?? null,
  }
}

function Avatar({ notification }) {
  const sender = notification.sender
  const unread = !notification.read
  const content = notification.type === 'birthday_reminder' ? (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FFF5F0', display: 'grid', placeItems: 'center', fontSize: 23 }}>
      🎂
    </div>
  ) : sender?.avatar_url ? (
    <img src={sender.avatar_url} alt={displayName(sender)} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
  ) : notification.type === 'message_received' && !sender ? (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F2F2F7', display: 'grid', placeItems: 'center', fontSize: 21 }}>
      💬
    </div>
  ) : (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: avatarColor(notification.data?.sender_id),
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontSize: 16,
        fontWeight: 800,
      }}
    >
      {initials(sender)}
    </div>
  )

  if (!unread) return <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{content}</div>

  return (
    <div style={{ width: 48, height: 48, padding: 2, borderRadius: '50%', background: GRADIENT, flexShrink: 0 }}>
      <div style={{ width: 44, height: 44, boxSizing: 'border-box', borderRadius: '50%', border: '2px solid #fff', overflow: 'hidden', background: '#fff' }}>
        {content}
      </div>
    </div>
  )
}

function EventThumb({ notification }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#FFF5F0', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 22 }}>
      {notification.event?.emoji || '🎉'}
    </div>
  )
}

function NotificationRow({ notification, onNavigate, onAcceptFriend, onDeclineFriend, onDismiss }) {
  const [removing, setRemoving] = useState(false)
  const title = notification.title || 'Activité'
  const body = notification.body || ''
  const hasEventThumb = notification.type === 'rsvp_received' || notification.type === 'message_received' || notification.type === 'event_invitation'
  const friendshipId = notification.data?.friendship_id || notification.data?.request_id

  async function handleFriendAction(action, event) {
    event.stopPropagation()
    if (!friendshipId) return
    setRemoving(true)
    const result = action === 'accept'
      ? await onAcceptFriend?.(friendshipId)
      : await onDeclineFriend?.(friendshipId)
    if (result?.error) {
      setRemoving(false)
    } else {
      window.setTimeout(() => onDismiss?.(notification.id), 200)
    }
  }

  return (
    <div
      onClick={() => onNavigate(notification)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        cursor: 'pointer',
        opacity: removing ? 0 : 1,
        maxHeight: removing ? 0 : 76,
        overflow: 'hidden',
        transition: 'opacity 200ms ease, max-height 200ms ease, padding 200ms ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <Avatar notification={notification} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: '#1C1C1E',
            fontSize: 14,
            lineHeight: 1.28,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <span style={{ fontWeight: 700 }}>{title}</span>{body ? ` ${body}` : ''}
        </div>
        <div style={{ marginTop: 4, color: '#8E8E93', fontSize: 12, fontWeight: 500 }}>
          {relativeLabel(notification.created_at)}
        </div>
      </div>

      {notification.type === 'friend_request' ? (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={event => handleFriendAction('accept', event)}
            style={{ border: 'none', borderRadius: 20, background: GRADIENT, color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 10px', cursor: 'pointer' }}
          >
            Accepter
          </button>
          <button
            type="button"
            onClick={event => handleFriendAction('decline', event)}
            style={{ border: 'none', borderRadius: 20, background: '#F2F2F7', color: '#1C1C1E', fontSize: 12, fontWeight: 700, padding: '8px 10px', cursor: 'pointer' }}
          >
            Refuser
          </button>
        </div>
      ) : notification.type === 'birthday_reminder' ? (
        <button
          type="button"
          onClick={event => { event.stopPropagation(); onNavigate(notification) }}
          style={{ border: 'none', borderRadius: 20, background: '#F2F2F7', color: '#1C1C1E', fontSize: 12, fontWeight: 700, padding: '8px 13px', cursor: 'pointer', flexShrink: 0 }}
        >
          Créer
        </button>
      ) : hasEventThumb ? (
        <EventThumb notification={notification} />
      ) : !notification.read ? (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: GRADIENT, flexShrink: 0 }} />
      ) : null}
    </div>
  )
}

function SkeletonRows() {
  return (
    <div style={{ paddingTop: 6 }}>
      {[0, 1, 2, 3, 4].map(item => (
        <div key={item} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px' }}>
          <div className="amiv-notification-skeleton" style={{ width: 44, height: 44, borderRadius: '50%', background: '#E5E5EA', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="amiv-notification-skeleton" style={{ height: 12, borderRadius: 6, background: '#E5E5EA', marginBottom: 8, width: '100%' }} />
            <div className="amiv-notification-skeleton" style={{ height: 12, borderRadius: 6, background: '#E5E5EA', width: '60%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyBellIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e055aa" />
          <stop offset="100%" stopColor="#f5a623" />
        </linearGradient>
      </defs>
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="url(#bellGrad)"
        strokeWidth="1.6"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="url(#bellGrad)"
        strokeWidth="1.6"
      />
    </svg>
  )
}

export default function NotificationPanel({
  isOpen,
  onClose,
  currentUser,
  onEventOpen,
  onMessagesOpen,
  onCreateEvent,
  onNotificationsRead,
  onAcceptFriend,
  onDeclineFriend,
}) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const touchStartX = useRef(null)
  const previousOverflow = useRef('')
  const onNotificationsReadRef = useRef(onNotificationsRead)

  useEffect(() => {
    onNotificationsReadRef.current = onNotificationsRead
  }, [onNotificationsRead])

  async function fetchNotifications() {
    if (!currentUser?.id) return
    setLoading(true)
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Erreur chargement notifications :', error)
      setLoading(false)
      return
    }

    const rows = notifs ?? []
    const eventIds = [...new Set(rows.map(n => n.data?.event_id).filter(Boolean))]
    const senderIds = [...new Set(rows.map(n => n.data?.sender_id).filter(Boolean))]
    const [{ data: events }, { data: senders }] = await Promise.all([
      eventIds.length
        ? supabase.from('events').select('id, name, emoji, birthday_person_user_id').in('id', eventIds)
        : Promise.resolve({ data: [] }),
      senderIds.length
        ? supabase.from('profiles').select('id, first_name, name, avatar_url').in('id', senderIds)
        : Promise.resolve({ data: [] }),
    ])
    const eventMap = Object.fromEntries((events ?? []).map(event => [event.id, event]))
    const senderMap = Object.fromEntries((senders ?? []).map(sender => [sender.id, sender]))

    setNotifications(rows.map(notification => ({
      ...notification,
      event: eventMap[notification.data?.event_id] ?? null,
      sender: senderMap[notification.data?.sender_id] ?? null,
    })))
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) fetchNotifications()
  }, [isOpen, currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id) return
    const channelName = 'notif-panel-' + currentUser.id + '-' + Math.random().toString(36).slice(2)
    const channel = supabase.channel(channelName)
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` },
      async payload => {
        const enriched = await enrichNotification(payload.new)
        setNotifications(prev => [enriched, ...prev.filter(item => item.id !== enriched.id)])
      }
    )
    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('[NotificationPanel] Realtime error:', status)
    })
    return () => { supabase.removeChannel(channel) }
  }, [currentUser?.id])

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return undefined
    previousOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(async () => {
      setNotifications(prev => prev.map(notification => ({ ...notification, read: true })))
      onNotificationsReadRef.current?.()
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', currentUser.id)
        .eq('read', false)
    }, 1000)

    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow.current
    }
  }, [isOpen, currentUser?.id])

  const filteredNotifications = useMemo(() => {
    const filter = FILTERS.find(item => item.key === activeFilter)
    if (!filter?.types) return notifications
    return notifications.filter(notification => filter.types.includes(notification.type))
  }, [activeFilter, notifications])

  const groups = useMemo(() => bucketNotifications(filteredNotifications), [filteredNotifications])
  const sections = [
    { key: 'new', title: 'Nouvelles', items: groups.new },
    { key: 'today', title: "Aujourd'hui", items: groups.today },
    { key: 'week', title: 'Cette semaine', items: groups.week },
    { key: 'earlier', title: 'Plus tôt', items: groups.earlier },
  ].filter(section => section.items.length > 0)

  function handleTouchStart(event) {
    touchStartX.current = event.touches[0].clientX
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return
    const deltaX = event.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (deltaX > 80) onClose?.()
  }

  function handleNavigate(notification) {
    if (notification.type === 'message_received' && notification.data?.event_id) {
      onClose?.()
      onMessagesOpen?.({ id: notification.data.event_id })
      return
    }
    if ((notification.type === 'rsvp_received' || notification.type === 'event_invitation') && notification.data?.event_id) {
      onClose?.()
      onEventOpen?.({ id: notification.data.event_id })
      return
    }
    if (notification.type === 'birthday_reminder') {
      onClose?.()
      onCreateEvent?.({ birthday_person_user_id: notification.data?.friend_id })
    }
  }

  return createPortal(
    <>
      <style>{`
        [data-notification-pill-scroll]::-webkit-scrollbar { display: none; }
        @keyframes amivNotificationPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .45; }
        }
        .amiv-notification-skeleton {
          animation: amivNotificationPulse 1.25s ease-in-out infinite;
        }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.20)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      />
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: '#fff',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px', paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ width: 32, height: 32, border: 'none', borderRadius: '50%', background: '#F2F2F7', color: '#1C1C1E', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft size={20} strokeWidth={2.2} />
          </button>
          <div style={{ color: '#1C1C1E', fontSize: 18, fontWeight: 700 }}>Activité</div>
        </div>

        <div
          data-notification-pill-scroll
          style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '8px 16px 12px', flexShrink: 0 }}
        >
          {FILTERS.map(filter => {
            const active = activeFilter === filter.key
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                style={{
                  border: 'none',
                  borderRadius: 20,
                  background: active ? GRADIENT : '#F2F2F7',
                  color: active ? '#fff' : '#8E8E93',
                  padding: '8px 15px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 0px)', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <SkeletonRows />
          ) : filteredNotifications.length === 0 ? (
            <div style={{ minHeight: '62vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8E8E93', textAlign: 'center', fontSize: 14 }}>
              <div style={{ marginBottom: 12, display: 'grid', placeItems: 'center' }}>
                <EmptyBellIcon />
              </div>
              <div>Aucune activité pour l'instant</div>
            </div>
          ) : (
            sections.map(section => (
              <section key={section.key} style={{ paddingBottom: 8 }}>
                <div style={{ padding: '13px 16px 6px', color: '#8E8E93', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {section.title}
                </div>
                {section.items.map(notification => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onNavigate={handleNavigate}
                    onAcceptFriend={onAcceptFriend}
                    onDeclineFriend={onDeclineFriend}
                    onDismiss={id => setNotifications(prev => prev.filter(item => item.id !== id))}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
