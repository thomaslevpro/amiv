import { useState, useEffect } from 'react'
import StatusBar from '../components/StatusBar'
import EventCard from '../components/EventCard'
import NotificationBell from '../components/NotificationBell'
import { supabase } from '../lib/supabase'

const filters = ['Tous', 'À venir', 'Mes événements', 'Passés']

function daysUntilBirthday(birthdateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const b = new Date(birthdateStr)
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next - today) / 86400000)
}

function formatCountdown(days) {
  if (days === 0) return "Aujourd'hui !"
  if (days === 1) return 'Demain'
  if (days < 7) return `Dans ${days} jours`
  if (days < 14) return 'Dans 1 sem.'
  if (days < 21) return 'Dans 2 sem.'
  if (days < 60) return `Dans ${Math.floor(days / 7)} sem.`
  return `Dans ${Math.floor(days / 30)} mois`
}

function enrichBirthdays(rows) {
  return rows
    .map(b => {
      const days = daysUntilBirthday(b.birthdate)
      return { ...b, days, countdown: formatCountdown(days), urgent: days < 7 }
    })
    .sort((a, b) => a.days - b.days)
}

export default function Home({ onEventClick, onCreateClick, onNotifEventClick }) {
  const [activeFilter, setActiveFilter] = useState(0)
  const [events, setEvents] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })
      if (error) console.error('Erreur lors du chargement des événements :', error)
      else setEvents(data)
    }
    fetchEvents()
  }, [])

  useEffect(() => {
    fetchBirthdays()
  }, [])

  async function fetchBirthdays() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('birthdays')
      .select('id, name, birthdate')
      .eq('user_id', user.id)
    if (error) console.error('Erreur lors du chargement des anniversaires :', error)
    else setBirthdays(enrichBirthdays(data ?? []))
  }

  async function handleAddBirthday(e) {
    e.preventDefault()
    if (!formName.trim() || !formDate) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase
        .from('birthdays')
        .insert({ name: formName.trim(), birthdate: formDate, user_id: user.id })
      if (!error) {
        setFormName('')
        setFormDate('')
        setShowForm(false)
        await fetchBirthdays()
      }
    }
    setSaving(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden', position: 'relative' }}>
      <StatusBar />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, padding: '6px 2px 0' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>Événements</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>3 à venir ce mois-ci</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <NotificationBell onEventClick={onNotifEventClick ?? onEventClick} />
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
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: '32px 0' }}>
            Aucun événement pour l'instant
          </div>
        ) : (
          events.map(ev => (
            <EventCard key={ev.id} event={ev} onClick={onEventClick} />
          ))
        )}

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
              🎂
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{b.name}</div>
              <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                {new Date(b.birthdate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <div style={{ fontSize: 12, color: b.urgent ? '#FF3B30' : '#8E8E93', fontWeight: b.urgent ? 600 : 400 }}>
                {b.countdown}
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.urgent ? '#FF3B30' : '#007AFF' }}/>
            </div>
          </div>
        ))}

        {/* Add birthday form / CTA */}
        {showForm ? (
          <form onSubmit={handleAddBirthday} style={{
            background: '#fff', borderRadius: 16, padding: '14px',
            marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>Nouvel anniversaire</div>
            <input
              type="text"
              placeholder="Nom"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              required
              style={{
                border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px',
                fontSize: 13, outline: 'none', color: '#1C1C1E',
              }}
            />
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              required
              style={{
                border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px',
                fontSize: 13, outline: 'none', color: '#1C1C1E',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Enregistrement…' : 'Ajouter'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormName(''); setFormDate('') }}
                style={{
                  padding: '11px 16px', borderRadius: 10, border: 'none',
                  background: '#F2F2F7', color: '#1C1C1E',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div
            onClick={() => setShowForm(true)}
            style={{
              background: '#fff', border: '1.5px dashed #AEAEB2', borderRadius: 14,
              padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#8E8E93',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', marginBottom: 10,
            }}
          >
            + Ajouter un anniversaire
          </div>
        )}
      </div>

    </div>
  )
}
