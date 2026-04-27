export default function HeroBirthdayCard({ birthday, onCreateEvent, onMessage }) {
  if (!birthday) {
    return (
      <div style={{
        background: '#fff', borderRadius: 20, padding: '28px 20px',
        textAlign: 'center', marginBottom: 16,
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎂</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#8E8E93' }}>
          Aucun anniversaire ce mois-ci
        </div>
      </div>
    )
  }

  const { name, birthdate, days } = birthday
  const age = new Date().getFullYear() - new Date(birthdate).getFullYear()
  const offset = Math.max(0, Math.min(169.6, 169.6 * days / 30))

  let countdownLabel
  if (days === 0) countdownLabel = "Aujourd'hui !"
  else if (days === 1) countdownLabel = 'Demain'
  else countdownLabel = `Dans ${days} jours`

  return (
    <div style={{
      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
      borderRadius: 20, padding: '20px 18px', marginBottom: 16,
      boxShadow: '0 4px 24px rgba(224,85,170,0.28)', color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🎂 Prochain anniversaire
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{name}</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 5 }}>
            {countdownLabel} · {age} ans
          </div>
        </div>

        <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
          <svg width="110" height="110" viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0 }}>
            <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="27" fill="none"
              stroke="#fff" strokeWidth="4"
              strokeDasharray="169.6"
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {days === 0 ? (
              <span style={{ fontSize: 36, lineHeight: 1 }}>🎉</span>
            ) : (
              <>
                <span style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: '#fff' }}>{days}</span>
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, marginTop: 2, letterSpacing: '0.06em' }}>JOURS</span>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onCreateEvent}
        style={{
          width: '100%', padding: '13px', borderRadius: 14, border: 'none',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          marginBottom: 10,
        }}
      >
        🎉 Organiser un événement
      </button>

      <div
        onClick={onMessage}
        style={{ textAlign: 'center', fontSize: 13, opacity: 0.88, cursor: 'pointer', fontWeight: 500 }}
      >
        ✉️ Envoyer un message à {name}
      </div>
    </div>
  )
}
