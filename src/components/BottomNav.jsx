import { Home, Calendar, MessageCircle, User } from 'lucide-react'

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

export default function BottomNav({ current, onChange, hasUnreadMessages, hasUnreadNotifications, hidden }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: hidden ? 'none' : 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      paddingLeft: 16,
      paddingRight: 16,
      background: 'transparent',
      pointerEvents: 'none',
    }}>
    <div style={{
      width: '100%',
      maxWidth: 430,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      background: 'rgba(255, 255, 255, 0.65)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '0.5px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      borderRadius: 40,
      paddingTop: 10,
      paddingBottom: 10,
      minHeight: 64,
      pointerEvents: 'auto',
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
        <Home size={26} strokeWidth={1.5} fill={current === 'home' ? 'currentColor' : 'none'} />
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
        <Calendar size={26} strokeWidth={1.5} fill={current === 'calendar' ? 'currentColor' : 'none'} />
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
        <MessageCircle size={26} strokeWidth={1.5} fill={current === 'messages' ? 'currentColor' : 'none'} />
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
        <User size={26} strokeWidth={1.5} fill={current === 'profile' ? 'currentColor' : 'none'} />
        {hasUnreadNotifications && <Badge />}
      </div>

    </div>
    </div>
  )
}
