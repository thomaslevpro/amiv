import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNotifications } from '../hooks/useNotifications'

const typeEmoji = {
  invitation_received: '🎉',
  rsvp_received: '✅',
  message_received: '💬',
  birthday_reminder: '🎂',
  event_updated: '📅',
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

export default function NotificationBell({ onEventClick }) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  function handleNotifClick(n) {
    markAsRead(n.id)
    if (n.data?.event_id && onEventClick) {
      onEventClick({ id: n.data.event_id })
    }
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          width: 32, height: 32, background: '#fff', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.10)', cursor: 'pointer',
          position: 'relative',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 14, height: 14, borderRadius: 7,
            background: '#FF3B30', border: '2px solid #F2F2F7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 800, color: '#fff',
            padding: '0 2px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 40, right: 0, width: 300,
          background: '#1e1035', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.40)',
          overflow: 'hidden', zIndex: 300,
          border: '1px solid rgba(200,160,255,0.15)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>Notifications</span>
            {unreadCount > 0 && (
              <span
                onClick={e => { e.stopPropagation(); markAllAsRead() }}
                style={{ fontSize: 11, color: '#c8a0ff', cursor: 'pointer', fontWeight: 600 }}
              >
                Tout marquer lu
              </span>
            )}
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                Aucune notification
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    background: n.read ? 'transparent' : 'rgba(200,160,255,0.08)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                    {typeEmoji[n.type] ?? '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: n.read ? 500 : 700, color: '#fff',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#c8a0ff', marginTop: 3 }}>
                      {relativeTime(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#c8a0ff', flexShrink: 0, marginTop: 5,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
