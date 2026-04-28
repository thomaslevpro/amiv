import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import StatusBar from '../components/StatusBar'

const typeEmoji = { 'Anniversaire': '🎂', 'Soirée': '🥂', 'Repas': '🍽️', 'Autre': '🎉' }

function EventCard({ event, onClick }) {
  const { name = 'Événement', date, location, type = 'Autre' } = event
  const emoji = typeEmoji[type] ?? '🎉'
  const dateStr = date
    ? new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Date à définir'
  return (
    <div
      onClick={() => onClick?.(event)}
      style={{
        background: '#fff', borderRadius: 16, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', cursor: 'pointer',
      }}
    >
      <div style={{
        width: 44, height: 44, background: '#FFF5F0', borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
          {dateStr}{location ? ` · ${location}` : ''}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )
}

export default function AllEvents({ onBack, onEventClick }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })
      if (!error) setEvents(data ?? [])
      setLoading(false)
    }
    fetchAll()
  }, [])

  const upcoming = events.filter(e => !e.date || new Date(e.date) >= new Date())
  const past = events.filter(e => e.date && new Date(e.date) < new Date())

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <StatusBar />

      {/* Header */}
      <div style={{ background: '#fff', padding: '10px 16px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#007AFF', marginRight: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Retour</span>
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', letterSpacing: -0.4 }}>Tous mes événements</div>
        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{events.length} événement{events.length !== 1 ? 's' : ''}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, paddingTop: 40 }}>Chargement…</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, paddingTop: 40 }}>
            Aucun événement pour l'instant
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
                  À venir · {upcoming.length}
                </div>
                {upcoming.map(e => <EventCard key={e.id} event={e} onClick={onEventClick} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', margin: '18px 0 10px' }}>
                  Passés · {past.length}
                </div>
                {past.map(e => (
                  <div key={e.id} style={{ opacity: 0.6 }}>
                    <EventCard event={e} onClick={onEventClick} />
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
