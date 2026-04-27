import { useState, useEffect } from 'react'
import StatusBar from '../components/StatusBar'
import NotificationBell from '../components/NotificationBell'
import HeroBirthdayCard from '../components/HeroBirthdayCard'
import BirthdayStrip from '../components/BirthdayStrip'
import MonthTimeline from '../components/MonthTimeline'
import { supabase } from '../lib/supabase'

function daysUntilBirthday(birthdateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const b = new Date(birthdateStr)
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next - today) / 86400000)
}

function enrichBirthdays(rows) {
  return rows
    .map(b => ({ ...b, days: daysUntilBirthday(b.birthdate) }))
    .sort((a, b) => a.days - b.days)
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

const typeEmoji = { 'Anniversaire': '🎂', 'Soirée': '🥂', 'Repas': '🍽️', 'Autre': '🎉' }

function SectionHeader({ title, badge, link, onLink }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93' }}>
          {title}
        </span>
        {badge && (
          <span style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(224,85,170,0.12)', color: '#e055aa', fontSize: 11, fontWeight: 700 }}>
            {badge}
          </span>
        )}
      </div>
      {link && (
        <span onClick={onLink} style={{ fontSize: 12, fontWeight: 600, color: '#007AFF', cursor: 'pointer' }}>
          {link}
        </span>
      )}
    </div>
  )
}

function EventCardCompact({ event, onClick }) {
  const { name = 'Événement', date, location, type = 'Autre' } = event
  const emoji = typeEmoji[type] ?? '🎉'
  const dateStr = date
    ? new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : ''
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
        width: 40, height: 40, background: '#FFF5F0', borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
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

function QuickActions({ onCreateEvent, onAddBirthday, onShare }) {
  const actions = [
    { icon: '🎉', label: 'Créer fête', onClick: onCreateEvent },
    { icon: '🎂', label: 'Ajouter anniv', onClick: onAddBirthday },
    { icon: '📨', label: 'Inviter', onClick: onShare },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, margin: '4px 0 16px' }}>
      {actions.map(({ icon, label, onClick }) => (
        <div
          key={label}
          onClick={onClick}
          style={{
            flex: 1, background: '#fff', borderRadius: 14, padding: '12px 8px',
            textAlign: 'center', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1C1C1E' }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Home({ onEventClick, onCreateClick, onNotifEventClick, onMessagesClick }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [events, setEvents] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [birthdayFilter, setBirthdayFilter] = useState('Ce mois')

  function showToast(message, isError = false) {
    setToast({ message, isError })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })
        .limit(3)
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
      .select('*')
      .eq('user_id', user.id)
      .order('birthdate', { ascending: true })
    if (error) {
      console.error('Erreur lors du chargement des anniversaires :', error)
      return
    }
    setBirthdays(enrichBirthdays(data ?? []))
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
      if (error) {
        console.error('Birthday save failed:', error)
        showToast('Erreur lors de la sauvegarde 😕', true)
      } else {
        setFormName('')
        setFormDate('')
        setShowForm(false)
        showToast('Anniversaire ajouté 🎂')
        await fetchBirthdays()
      }
    }
    setSaving(false)
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ url: 'https://amiv.app' }).catch(() => {})
    }
  }

  const greeting = getGreeting()
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const currentMonth = today.getMonth()
  const birthdaysThisMonth = birthdays.filter(b =>
    parseInt(b.birthdate.split('-')[1], 10) - 1 === currentMonth
  )
  const heroBirthday = birthdaysThisMonth[0] ?? null

  const displayedBirthdays = birthdayFilter === 'Ce mois' ? birthdaysThisMonth : birthdays

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden', position: 'relative' }}>
      <StatusBar />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, padding: '6px 2px 0' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>{greeting}</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{dateStr}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <NotificationBell onEventClick={onNotifEventClick ?? onEventClick} />
            <button
              onClick={onCreateClick}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                boxShadow: '0 2px 8px rgba(224,85,170,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <HeroBirthdayCard
          birthday={heroBirthday}
          onCreateEvent={onCreateClick}
          onMessage={onMessagesClick}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Anniversaires
          </span>
          <div style={{ display: 'flex', background: '#F2F2F7', borderRadius: 20, padding: 2, gap: 2 }}>
            {['Ce mois', 'Tous'].map(opt => (
              <button
                key={opt}
                onClick={() => setBirthdayFilter(opt)}
                style={{
                  padding: '4px 12px', borderRadius: 18, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: birthdayFilter === opt ? 'white' : 'transparent',
                  color: birthdayFilter === opt ? '#1C1C1E' : '#8E8E93',
                  boxShadow: birthdayFilter === opt ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <BirthdayStrip birthdays={displayedBirthdays} onRefetch={fetchBirthdays} onToast={showToast} />
        <MonthTimeline birthdays={birthdaysThisMonth} events={events} today={today} />

        <SectionHeader title="Mes événements" link="Voir tout" onLink={() => {}} />
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: '20px 0' }}>
            Aucun événement pour l'instant
          </div>
        ) : (
          events.map(e => <EventCardCompact key={e.id} event={e} onClick={onEventClick} />)
        )}

        <QuickActions
          onCreateEvent={onCreateClick}
          onAddBirthday={() => setShowForm(true)}
          onShare={handleShare}
        />

        {showForm && (
          <form
            onSubmit={handleAddBirthday}
            style={{
              background: '#fff', borderRadius: 16, padding: 14,
              marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>Nouvel anniversaire</div>
            <input
              type="text"
              placeholder="Nom"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              required
              style={{ border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E' }}
            />
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              required
              style={{ border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1, padding: 11, borderRadius: 10, border: 'none',
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
        )}

      </div>

      {toast && (
        <div style={{
          position: 'absolute', bottom: 100, left: 16, right: 16, zIndex: 200,
          background: toast.isError ? '#FF3B30' : '#34C759',
          color: '#fff', borderRadius: 14, padding: '13px 18px',
          textAlign: 'center', fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
