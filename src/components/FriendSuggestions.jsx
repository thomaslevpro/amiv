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

export default function FriendSuggestions({ suggestions, onAdd }) {
  if (!suggestions?.length) return null

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        {suggestions.map((s, i) => (
          <div key={s.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            borderBottom: i < suggestions.length - 1 ? '1px solid #F2F2F7' : 'none',
          }}>
            <Avatar url={s.avatar_url} name={s.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
              {s.shared_event_name && (
                <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.shared_event_name}
                </div>
              )}
            </div>
            <button
              onClick={() => onAdd?.(s.user_id, s.event_id ?? null)}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                color: '#fff', border: 'none', borderRadius: 20,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Ajouter
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
