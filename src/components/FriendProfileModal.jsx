import { createPortal } from 'react-dom'
import { getDaysUntilBirthday } from '../utils/dateUtils'

function getInitials(name) {
  return (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatBirthday(dateString) {
  if (!dateString) return null
  const d = new Date(dateString)
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()
  const month = d.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
  const daysUntil = getDaysUntilBirthday(dateString)
  const suffix = daysUntil === 0
    ? "c'est aujourd'hui !"
    : `dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}`
  return `🎂 ${day} ${month} ${year} — ${suffix}`
}

export default function FriendProfileModal({ friend, onClose, onSendMessage }) {
  if (!friend) return null

  const birthdayText = formatBirthday(friend.birthday)

  return createPortal(
    <>
      <style>{`
        @keyframes friendModalIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            background: '#fff',
            borderRadius: 24,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            padding: 24,
            width: 320,
            animation: 'friendModalIn 220ms ease both',
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, lineHeight: 1, color: '#8E8E93', padding: 0,
            }}
          >
            ×
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            {friend.friend_avatar ? (
              <img
                src={friend.friend_avatar}
                alt={friend.friend_name}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {getInitials(friend.friend_name)}
              </div>
            )}

            <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', textAlign: 'center' }}>
              {friend.friend_name}
            </div>

            {birthdayText && (
              <div style={{ fontSize: 13, color: '#8E8E93', textAlign: 'center' }}>
                {birthdayText}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => { console.log('[FriendModal] bouton cliqué', friend); onSendMessage?.(friend); onClose() }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                color: '#fff', fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Envoyer un message
            </button>

            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                background: '#F5F5F5',
                color: '#1C1C1E', fontSize: 15, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
