export default function EventInviteSection({ friends, invitedIds, copySuccess, onInvite, onCopyLink }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
        Inviter des amis
      </div>

      {friends.length === 0 ? (
        <div style={{ background: '#F5F5F5', borderRadius: 16, padding: '20px', textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: '#8E8E93' }}>Aucun ami à inviter pour l'instant</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 10, overflow: 'hidden' }}>
          {friends.map((friend, i) => (
            <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: '#e055aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {(friend.first_name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{friend.first_name}</div>
              {invitedIds.has(friend.id) ? (
                <div style={{ background: 'rgba(52,199,89,0.10)', color: '#34C759', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>
                  Invité ✓
                </div>
              ) : (
                <div onClick={() => onInvite(friend.id)} style={{ background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Inviter
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginBottom: 8 }}>Ou partage le lien</div>
        <div onClick={onCopyLink} style={{ width: '100%', borderRadius: 12, padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: copySuccess ? 'rgba(52,199,89,0.10)' : '#F5F5F5', color: copySuccess ? '#34C759' : '#1C1C1E', boxSizing: 'border-box' }}>
          {copySuccess ? '✓ Lien copié !' : '🔗 Copier le lien d\'invitation'}
        </div>
      </div>
    </div>
  )
}
