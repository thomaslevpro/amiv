import AmivHeartIcon from './icons/AmivHeartIcon'

export default function NotificationBell({ unreadCount = 0, onClick }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onClick}
        aria-label="Ouvrir l'activité"
        style={{
          width: 32,
          height: 32,
          background: '#fff',
          border: 'none',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <AmivHeartIcon size={16} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              background: '#FF3B30',
              border: '2px solid #F2F2F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 800,
              color: '#fff',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
