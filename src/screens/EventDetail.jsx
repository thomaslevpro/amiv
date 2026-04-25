import { useState } from 'react'
import StatusBar from '../components/StatusBar'

export default function EventDetail({ event, onBack, onInvitation }) {
  const [rsvp, setRsvp] = useState(null)

  if (!event) return null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      {/* Hero gradient header */}
      <div style={{ background: 'linear-gradient(135deg,#e055aa,#f5a623)', padding: '52px 20px 28px', textAlign: 'center', color: '#fff', flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 28px', fontSize: 12, fontWeight: 700, color: '#fff' }}>
          <span>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="17" height="12" viewBox="0 0 17 12" fill="white"><rect x="0" y="4" width="3" height="8" rx="0.6"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="0.6"/><rect x="9" y="0.5" width="3" height="11.5" rx="0.6"/><rect x="13.5" y="0" width="3" height="12" rx="0.6" opacity="0.5"/></svg>
            <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3" stroke="white" strokeOpacity=".6"/><rect x="1.5" y="1.5" width="18" height="9" rx="2.2" fill="white"/></svg>
          </div>
        </div>
        <div onClick={onBack} style={{ position: 'absolute', top: 40, left: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#fff' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontSize: 16 }}>Retour</span>
        </div>
        <div style={{ fontSize: 48, marginBottom: 10 }}>{event.emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 5, letterSpacing: -0.3 }}>{event.eventName}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{event.name} · {event.age}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Info card */}
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          {[
            { icon: '📅', label: 'Date', value: event.date },
            { icon: '📍', label: 'Lieu', value: event.location },
            { icon: '👤', label: 'Organisé par', value: event.organizer },
            { icon: '👥', label: 'Participants', value: `${event.guests} confirmés` },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < 3 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ fontSize: 17, width: 28, textAlign: 'center', flexShrink: 0 }}>{row.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{row.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        {event.description && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '14px', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: '#1C1C1E', lineHeight: 1.5 }}>{event.description}</div>
          </div>
        )}

        {/* RSVP */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', margin: '14px 0 10px' }}>Votre réponse</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { label: "✓ J'y serai !", key: 'yes' },
            { label: '🤔 Peut-être', key: 'maybe' },
            { label: '✕ Non', key: 'no' },
          ].map(r => (
            <div key={r.key} onClick={() => setRsvp(r.key)} style={{
              flex: 1, padding: 12, borderRadius: 12, textAlign: 'center',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: rsvp === r.key
                ? (r.key === 'yes' ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#1C1C1E')
                : rsvp && rsvp !== r.key ? '#F2F2F7' : (r.key === 'yes' ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7'),
              color: (rsvp === r.key && r.key !== 'no' && r.key !== 'maybe') || (!rsvp && r.key === 'yes')
                ? '#fff'
                : rsvp === r.key ? '#fff' : '#1C1C1E',
              opacity: rsvp && rsvp !== r.key ? 0.5 : 1,
              transition: 'all 0.15s',
            }}>
              {r.label}
            </div>
          ))}
        </div>

        {/* See invitation */}
        <div onClick={onInvitation} style={{
          background: '#fff', borderRadius: 16, padding: 14, fontSize: 14, fontWeight: 600,
          color: '#1C1C1E', textAlign: 'center', cursor: 'pointer',
          boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 10,
        }}>
          📬 Voir l'invitation
        </div>

        {/* Calendar */}
        <div style={{
          border: '1.5px dashed #AEAEB2', borderRadius: 14, padding: 12, textAlign: 'center',
          fontSize: 12, fontWeight: 500, color: '#8E8E93', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          📅 Ajouter à mon calendrier
        </div>
      </div>
    </div>
  )
}
