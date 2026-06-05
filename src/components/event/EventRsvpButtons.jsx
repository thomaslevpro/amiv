export default function EventRsvpButtons({ rsvpStatus, loading, onRsvp, embedded = false }) {
  const normalizedStatus = rsvpStatus === 'maybe' ? 'pending' : rsvpStatus

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', margin: embedded ? '16px 0 10px' : '6px 0 10px' }}>
        Votre réponse
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {[
          { status: 'going', label: "✓ J'y serai !" },
          { status: 'pending', label: 'Peut-être' },
          { status: 'declined', label: 'Non' },
        ].map(({ status, label }) => {
          const active = normalizedStatus === status
          return (
            <div key={status} onClick={() => !loading && onRsvp(status)} style={{ flex: 1, minHeight: 44, padding: '11px 8px', borderRadius: active ? 14 : 12, textAlign: 'center', fontSize: 13, fontWeight: 800, cursor: loading ? 'default' : 'pointer', background: active ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F5F5F5', color: active ? '#fff' : '#1C1C1E', boxShadow: 'none', transition: 'all 0.15s', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {status === 'declined' && <span style={{ fontSize: 18, lineHeight: 0.8, fontWeight: 500 }}>×</span>}
              {label}
            </div>
          )
        })}
      </div>
    </>
  )
}
