const HomeIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {active
      ? <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-5h-6v5H4a1 1 0 0 1-1-1V9.5z"
          fill="currentColor" stroke="none"/>
      : <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-5h-6v5H4a1 1 0 0 1-1-1V9.5z"/>
    }
  </svg>
)

const CalendarIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {active ? (
      <>
        <rect x="3" y="4" width="18" height="18" rx="3" fill="currentColor" stroke="none"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth={2}/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth={2}/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth={2}/>
      </>
    ) : (
      <>
        <rect x="3" y="4" width="18" height="18" rx="3"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </>
    )}
  </svg>
)

const MessagesIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {active
      ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          fill="currentColor" stroke="none"/>
      : <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    }
  </svg>
)

const ProfileIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {active ? (
      <>
        <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" stroke="none"/>
      </>
    ) : (
      <>
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </>
    )}
  </svg>
)

const Badge = () => (
  <div style={{
    position: 'absolute',
    top: 2,
    right: 16,
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: '#FF3B30',
    border: '1.5px solid #fff',
    pointerEvents: 'none',
  }} />
)

export default function BottomNav({ current, onChange, onCreateClick, hasUnreadMessages, hasUnreadNotifications, hidden }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 398,
      margin: '0 16px 24px',
      zIndex: 100,
      display: hidden ? 'none' : 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      background: 'rgba(255, 255, 255, 0.65)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '0.5px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
      borderRadius: 40,
      paddingTop: 8,
      paddingBottom: 8,
      minHeight: 64,
    }}>

      {/* Home */}
      <div onClick={() => onChange('home')} style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        paddingBottom: 4,
        color: current === 'home' ? '#1C1C1E' : '#8E8E93',
      }}>
        <HomeIcon active={current === 'home'} />
      </div>

      {/* Calendar */}
      <div onClick={() => onChange('calendar')} style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        paddingBottom: 4,
        color: current === 'calendar' ? '#1C1C1E' : '#8E8E93',
      }}>
        <CalendarIcon active={current === 'calendar'} />
      </div>

      {/* Create — pill centré style Instagram */}
      <div onClick={onCreateClick} style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        paddingBottom: 4,
        paddingLeft: 6,
        paddingRight: 6,
      }}>
        <div style={{
          width: 80,
          height: 44,
          borderRadius: 22,
          background: 'rgba(0, 0, 0, 0.08)',
          border: '0.5px solid rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#1C1C1E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
      </div>

      {/* Messages */}
      <div onClick={() => onChange('messages')} style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        paddingBottom: 4,
        position: 'relative',
        color: current === 'messages' ? '#1C1C1E' : '#8E8E93',
      }}>
        <MessagesIcon active={current === 'messages'} />
        {hasUnreadMessages && <Badge />}
      </div>

      {/* Profile */}
      <div onClick={() => onChange('profile')} style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        paddingBottom: 4,
        position: 'relative',
        color: current === 'profile' ? '#1C1C1E' : '#8E8E93',
      }}>
        <ProfileIcon active={current === 'profile'} />
        {hasUnreadNotifications && <Badge />}
      </div>

    </div>
  )
}
