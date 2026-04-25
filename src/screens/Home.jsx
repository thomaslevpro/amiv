import { useState } from 'react'
import StatusBar from '../components/StatusBar'
import EventCard from '../components/EventCard'
import { events, birthdays } from '../data/mockData'

const filters = ['Tous', 'À venir', 'Mes événements', 'Passés']

export default function Home({ onEventClick, onCreateClick }) {
  const [activeFilter, setActiveFilter] = useState(0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden', position: 'relative' }}>
      <StatusBar />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, padding: '6px 2px 0' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>Événements</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>3 à venir ce mois-ci</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            ].map((icon, i) => (
              <div key={i} style={{ width: 32, height: 32, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', cursor: 'pointer' }}>
                {icon}
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', padding: '2px 0' }}>
          {filters.map((f, i) => (
            <div key={i} onClick={() => setActiveFilter(i)} style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: i === activeFilter ? 600 : 500,
              whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
              background: i === activeFilter ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#fff',
              color: i === activeFilter ? '#fff' : '#8E8E93',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              {f}
            </div>
          ))}
        </div>

        {/* Events */}
        {events.map(ev => (
          <EventCard key={ev.id} event={ev} onClick={onEventClick} />
        ))}

        {/* Birthdays section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93' }}>
            Anniversaires à venir
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#007AFF', cursor: 'pointer' }}>Voir tout</div>
        </div>

        {birthdays.map(b => (
          <div key={b.id} style={{
            background: '#fff', borderRadius: 16, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
          }}>
            <div style={{ width: 42, height: 42, background: '#FBBF9A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {b.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{b.name}</div>
              <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{b.age}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>{b.countdown}</div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.urgent ? '#FF3B30' : '#007AFF' }}/>
            </div>
          </div>
        ))}

        {/* Add birthday CTA */}
        <div style={{
          background: '#fff', border: '1.5px dashed #AEAEB2', borderRadius: 14,
          padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#8E8E93',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', marginBottom: 10,
        }}>
          + Ajouter un anniversaire
        </div>
      </div>

      {/* FAB */}
      <div onClick={onCreateClick} style={{
        position: 'absolute', bottom: 80, right: 16,
        width: 52, height: 52, background: 'linear-gradient(135deg,#e055aa,#f5a623)',
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 4px 20px rgba(224,85,170,0.4)', zIndex: 20,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
    </div>
  )
}
