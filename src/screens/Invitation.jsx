import { useState } from 'react'
import { Cake, Calendar, MapPin, User } from 'lucide-react'

export default function Invitation({ event, onBack }) {
  const [rsvp, setRsvp] = useState('yes')

  if (!event) return null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', overflow: 'hidden' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#e055aa,#f5a623)', padding: '16px 20px 28px', textAlign: 'center', color: '#fff', flexShrink: 0, position: 'relative' }}>
        <div onClick={onBack} style={{ position: 'absolute', top: 14, left: 16, cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
        <div style={{ fontSize: 52, display: 'block', marginBottom: 10 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 5 }}>Tu es invité(e) !</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Soirée surprise pour {event.name}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Info card */}
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          {[
            { icon: <Cake size={16} strokeWidth={1.5} />, label: 'Événement', value: `${event.eventName} — ${event.age}` },
            { icon: <Calendar size={16} strokeWidth={1.5} />, label: 'Date', value: event.date },
            { icon: <MapPin size={16} strokeWidth={1.5} />, label: 'Lieu', value: event.location },
            { icon: <User size={16} strokeWidth={1.5} />, label: 'Organisé par', value: event.organizer },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < 3 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{row.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{row.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Avatars */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 8 }}>
          Participants ({event.guests} confirmés)
        </div>
        <div style={{ display: 'flex', marginBottom: 16 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 32, height: 32, background: '#FBBF9A', borderRadius: '50%', border: '2px solid #fff', marginLeft: i > 0 ? -6 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>👤</div>
          ))}
          <div style={{ width: 32, height: 32, background: '#F2F2F7', borderRadius: '50%', border: '2px solid #fff', marginLeft: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#8E8E93' }}>
            +{event.guests - 3}
          </div>
        </div>

        {/* RSVP */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 10 }}>Votre réponse</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            { label: "✓ J'y serai !", key: 'yes' },
            { label: '🤔 Peut-être', key: 'maybe' },
            { label: '✕ Non', key: 'no' },
          ].map(r => (
            <div key={r.key} onClick={() => setRsvp(r.key)} style={{
              flex: 1, padding: 12, borderRadius: 12, textAlign: 'center',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: rsvp === r.key ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
              color: rsvp === r.key ? '#fff' : '#1C1C1E',
              opacity: rsvp && rsvp !== r.key ? 0.5 : 1,
              transition: 'all 0.15s',
            }}>
              {r.label}
            </div>
          ))}
        </div>

        {/* Message */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Message (optionnel)</div>
        <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', fontSize: 14, color: '#8E8E93', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          Écrire un message…
        </div>

        {/* Calendar */}
        <div style={{
          border: '1.5px solid #F2F2F7', background: '#fff', borderRadius: 14, padding: 12, textAlign: 'center',
          fontSize: 12, fontWeight: 500, color: '#8E8E93', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Calendar size={16} strokeWidth={1.5} />
          Ajouter à mon calendrier
        </div>
      </div>
    </div>
  )
}
