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
            padding: '10px 16px',
            borderBottom: i < requests.length - 1 ? '1px solid #F2F2F7' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <Avatar url={req.requester_avatar} name={req.requester_name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {req.requester_name}
              </div>
              {req.event_name && (
                <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Via · {req.event_name}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => onAccept?.(req.friendship_id)}
                style={{
                  padding: '7px 14px',
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Accepter
              </button>
              <button
                onClick={() => onDecline?.(req.friendship_id)}
                style={{
                  padding: '7px 14px',
                  background: '#F2F2F7', color: '#1C1C1E', border: 'none', borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
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
