import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCircle2, Cake, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNotifications } from '../hooks/useNotifications'
import { useActivity } from '../hooks/useActivity'

const typeIcon = {
  invitation_received: '🎉',
  rsvp_received: <CheckCircle2 size={16} className="text-green-500" strokeWidth={1.5} />,
  message_received: '💬',
  birthday_reminder: <Cake size={16} strokeWidth={1.5} />,
  event_updated: <Calendar size={16} strokeWidth={1.5} />,
}

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'hier'
  return `il y a ${d}j`
}

function getActivityContent(item) {
  const data = item.data || {}
  const actorName = data.actor_name
  const eventName = data.event_name
  const friendName = data.friend_name

  if (item.type === 'rsvp_confirmed') {
    return { emoji: '✅', text: `${actorName || 'Quelqu’un'} participera à ${eventName || 'un événement'}` }
  }
  if (item.type === 'event_created') {
    return { emoji: '🎉', text: `${actorName || 'Quelqu’un'} a créé · ${eventName || 'un événement'}` }
  }
  if (item.type === 'friend_added') {
    return { emoji: '👋', text: `${actorName || 'Quelqu’un'} et ${friendName || 'un ami'} sont amis` }
  }

  return { emoji: '🔔', text: actorName ?? 'Activité' }
}

export default function NotificationBell({ onEventClick }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('notifs')
  const [lastSeenActivity, setLastSeenActivity] = useState(
    () => localStorage.getItem('last_seen_activity') ?? '1970-01-01'
  )
  const [userId, setUserId] = useState(null)
  const touchStartX = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const { activities, loading: activityLoading } = useActivity(userId)
  const unseenActivityCount = activities.filter(
    a => new Date(a.created_at) > new Date(lastSeenActivity)
  ).length
  const total = unreadCount + unseenActivityCount

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  function handleNotifClick(n) {
    markAsRead(n.id)
    if (n.data?.event_id && onEventClick) {
      onEventClick({ id: n.data.event_id })
    }
    setOpen(false)
  }

  function markActivitySeen() {
    const now = new Date().toISOString()
    localStorage.setItem('last_seen_activity', now)
    setLastSeenActivity(now)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (deltaX > 60) setOpen(false)
  }

  const drawer = open ? createPortal(
    <>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 500,
        }}
      />
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 340,
          maxWidth: '90vw',
          background: '#fff',
          zIndex: 501,
          boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
          transition: 'transform 0.28s cubic-bezier(0.32,0,0.15,1)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 18px 0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>
              Notifications
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer les notifications"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 0,
                background: '#F2F2F7',
                color: '#1C1C1E',
                fontSize: 18,
                lineHeight: '32px',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
          {unreadCount > 0 && (
            <div
              onClick={e => { e.stopPropagation(); markAllAsRead() }}
              style={{
                display: 'inline-block',
                marginTop: 10,
                fontSize: 12,
                fontWeight: 600,
                color: 'transparent',
                backgroundImage: 'linear-gradient(135deg,#e055aa,#f5a623)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                cursor: 'pointer',
              }}
            >
              Tout marquer lu
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          margin: '14px 18px',
        }}>
          {[
            { id: 'notifs', label: '🔔 Notifications' },
            { id: 'activity', label: '⚡ Activité' },
          ].map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'activity' && activeTab !== 'activity') {
                    markActivitySeen()
                  }
                  setActiveTab(tab.id)
                }}
                style={{
                  flex: 1,
                  border: 0,
                  borderRadius: 999,
                  padding: '9px 10px',
                  background: active ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                  color: active ? '#fff' : '#8E8E93',
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'notifs' ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{
                height: '100%',
                minHeight: 260,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: '#8E8E93',
                fontSize: 13,
              }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                <div>Tout est à jour</div>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    padding: '12px 18px',
                    cursor: 'pointer',
                    background: n.read ? 'transparent' : 'rgba(224,85,170,0.06)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    {typeIcon[n.type] ?? '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: n.read ? 500 : 700,
                      color: '#1C1C1E',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{
                        fontSize: 11,
                        color: '#8E8E93',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#e055aa', marginTop: 3 }}>
                      {relativeTime(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                      flexShrink: 0,
                      marginTop: 5,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: activityLoading ? '0 14px' : 0 }}>
            {activityLoading ? (
              [0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    height: 52,
                    background: '#F2F2F7',
                    borderRadius: 10,
                    marginBottom: 8,
                  }}
                />
              ))
            ) : activities.length === 0 ? (
              <div style={{
                height: '100%',
                minHeight: 260,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 32 }}>⚡</div>
                <div style={{ fontSize: 14, color: '#8E8E93', marginTop: 10 }}>
                  Pas encore d'activité
                </div>
              </div>
            ) : (
              activities.map(item => {
                const activity = getActivityContent(item)
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '12px 14px',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    {item.data?.avatar_url ? (
                      <img
                        src={item.data.avatar_url}
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 32,
                        height: 32,
                        background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                        flexShrink: 0,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#fff',
                      }}>
                        {(item.data?.actor_name ?? '?')[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1C1C1E',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {activity.text}
                      </div>
                      <div style={{ fontSize: 11, color: '#e055aa', marginTop: 3 }}>
                        {relativeTime(item.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </>,
    document.body
  ) : null

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          width: 32, height: 32, background: '#fff', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.10)', cursor: 'pointer',
          position: 'relative',
        }}
      >
        <Bell size={16} strokeWidth={1.5} color="#1C1C1E" />
        {total > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 14, height: 14, borderRadius: 7,
            background: '#FF3B30', border: '2px solid #F2F2F7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 800, color: '#fff',
            padding: '0 2px',
          }}>
            {total > 9 ? '9+' : total}
          </div>
        )}
      </div>
      {drawer}
    </div>
  )
}
