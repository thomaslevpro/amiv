import { X } from 'lucide-react'
import { BG, BLACK, FONT, GRAY1, WHITE } from './constants'
import { Avatar, SkeletonRow } from './MessageUI'

export default function NewMessageSheet({ friends, loading, onClose, onSelectFriend }) {
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
                <Avatar name={friend.friend_name} url={friend.friend_avatar} isCloseFriend={friend.is_close_friend} />
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
