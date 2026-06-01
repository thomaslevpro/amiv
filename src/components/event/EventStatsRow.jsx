export default function EventStatsRow({ rsvpStats }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
      {[
        { count: rsvpStats.confirmed, label: 'Confirmés' },
        { count: rsvpStats.pending, label: 'En attente' },
        { count: rsvpStats.declined, label: 'Déclinés' },
      ].map((s, i) => (
        <div key={i} style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '12px 8px', textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>{s.count}</div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}
