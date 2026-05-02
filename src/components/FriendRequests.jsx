function Avatar({ url, name, size = 44 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.36,
    }}>
      {initials}
    </div>
  )
}

export default function FriendRequests({ requests, onAccept, onDecline }) {
  if (!requests?.length) return null

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        {requests.map((req, i) => (
          <div key={req.friendship_id} style={{
            padding: '14px 16px',
            borderBottom: i < requests.length - 1 ? '1px solid #F2F2F7' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Avatar url={req.requester_avatar} name={req.requester_name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {req.requester_name}
                </div>
                {req.event_name && (
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Via · {req.event_name}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onAccept?.(req.friendship_id)}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Accepter
              </button>
              <button
                onClick={() => onDecline?.(req.friendship_id)}
                style={{
                  flex: 1, padding: '10px 0',
                  background: '#F2F2F7', color: '#1C1C1E', border: 'none', borderRadius: 12,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
