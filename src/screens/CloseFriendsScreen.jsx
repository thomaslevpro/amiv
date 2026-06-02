import { ArrowLeft } from 'lucide-react'
import { useFriendships } from '../hooks/useFriendships'

export default function CloseFriendsScreen({ onBack, userId }) {
  const { friends, toggleCloseFriend } = useFriendships(userId)

  return (
    <div style={{ flex: 1, background: '#faf9fb', overflowY: 'auto', padding: '14px 16px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: 'none',
            background: '#fff',
            color: '#1C1C1E',
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <div style={{ color: '#1C1C1E', fontSize: 24, fontWeight: 900, letterSpacing: '-0.2px' }}>Amis proches</div>
      </div>

      <div style={{ fontSize: 13, color: '#8E8E93', margin: '-10px 2px 18px' }}>Ces amis voient tes dispos privées</div>

      {friends.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 40 }}>👥</div>
          <div style={{ fontSize: 14, color: '#8E8E93', marginTop: 8 }}>Aucun ami pour l'instant</div>
        </div>
      ) : (
        friends.map(friend => {
          const displayName = `${friend.friend_first_name ?? ''} ${friend.friend_name ?? ''}`.trim()
          const initials = `${friend.friend_first_name?.[0] ?? ''}${friend.friend_name?.[0] ?? ''}`.toUpperCase()

          return (
            <div
              key={friend.friendship_id}
              onClick={() => toggleCloseFriend(friend.friendship_id)}
              style={{
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                padding: '12px 14px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
            >
              {friend.friend_avatar ? (
                <img
                  src={friend.friend_avatar}
                  alt=""
                  style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {initials}
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', flex: 1 }}>{displayName}</div>
              <div style={{
                width: 44, height: 26, borderRadius: 999, flexShrink: 0,
                background: friend.is_close_friend
                  ? 'linear-gradient(135deg,#e055aa,#f5a623)'
                  : '#E5E5EA',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 3,
                  left: friend.is_close_friend ? 21 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                  transition: 'left 0.2s',
                }} />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
