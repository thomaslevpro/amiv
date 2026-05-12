import { useState, useEffect, useRef } from 'react'
import NotificationBell from '../components/NotificationBell'
import HeroBirthdayCard from '../components/HeroBirthdayCard'
import BirthdayStrip from '../components/BirthdayStrip'
import MonthTimeline from '../components/MonthTimeline'
import FriendRequests from '../components/FriendRequests'
import FriendSuggestions from '../components/FriendSuggestions'
import AddAmivModal from '../components/AddAmivModal'
import { useFriendships } from '../hooks/useFriendships'
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

const CONFETTI_PIECES = [
  { left: '7%',  top: '18%', w: 8, h: 5, color: '#FF6B9D', rotate: 25,  circle: false },
  { left: '17%', top: '68%', w: 6, h: 6, color: '#FFD93D', rotate: 0,   circle: true  },
  { left: '24%', top: '28%', w: 5, h: 8, color: '#6BCB77', rotate: -15, circle: false },
  { left: '34%', top: '55%', w: 6, h: 6, color: '#e055aa', rotate: 0,   circle: true  },
  { left: '44%', top: '72%', w: 7, h: 5, color: '#4D96FF', rotate: 45,  circle: false },
  { left: '53%', top: '14%', w: 6, h: 6, color: '#e055aa', rotate: 0,   circle: true  },
  { left: '61%', top: '58%', w: 5, h: 7, color: '#f5a623', rotate: -30, circle: false },
  { left: '70%', top: '22%', w: 8, h: 5, color: '#FF6B9D', rotate: 60,  circle: false },
  { left: '79%', top: '76%', w: 6, h: 6, color: '#6BCB77', rotate: 0,   circle: true  },
  { left: '86%', top: '38%', w: 5, h: 8, color: '#FFD93D', rotate: -45, circle: false },
  { left: '93%', top: '16%', w: 7, h: 5, color: '#4D96FF', rotate: 30,  circle: false },
]

function InviteCard({ onShare }) {
  return (
    <div
      onClick={onShare}
      style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      {CONFETTI_PIECES.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c.left,
            top: c.top,
            width: c.w,
            height: c.h,
            background: c.color,
            borderRadius: c.circle ? '50%' : 2,
            opacity: 0.75,
            transform: `rotate(${c.rotate}deg)`,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      ))}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.3 }}>
            Offrez Amiv à vos proches
          </div>
          <div style={{ fontSize: 12, fontWeight: 400, color: '#8E8E93', marginTop: 3, lineHeight: 1.4 }}>
            Parce que les bons moments méritent d'être partagés
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onShare() }}
          style={{
            background: 'linear-gradient(135deg, #e055aa, #f5a623)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 12,
            padding: '9px 14px',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Envoyer le lien
        </button>
      </div>
    </div>
  )
}

export default function Home({ onEventClick, onCreateClick, onNotifEventClick, onMessagesClick, onAllEventsClick, session }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const userId = session?.user?.id
  const { suggestions, pendingRequests, sendRequest, acceptRequest, declineRequest } = useFriendships(userId)

  const [invitations, setInvitations] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [showAddAmiv, setShowAddAmiv] = useState(false)
  const [toast, setToast] = useState(null)
  const [birthdayFilter, setBirthdayFilter] = useState('Tous')
  const filterScrollRef = useRef(null)

  function showToast(message, isError = false) {
    setToast({ message, isError })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchInvitations = async () => {
    if (!userId) return
    const { data: rsvps, error: rsvpError } = await supabase
      .from('rsvps')
      .select('id, event_id')
      .eq('user_id', userId)
      .eq('status', 'invited')
    if (rsvpError) { console.error('Erreur invitations (rsvps):', rsvpError); return }
    if (!rsvps?.length) { setInvitations([]); return }

    const eventIds = rsvps.map(r => r.event_id)
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('id, name, date')
      .in('id', eventIds)
    if (eventsError) { console.error('Erreur invitations (events):', eventsError); return }

    const eventsById = Object.fromEntries((eventsData ?? []).map(e => [e.id, e]))
    setInvitations(rsvps.map(r => ({ ...r, events: eventsById[r.event_id] ?? null })))
  }

  useEffect(() => {
    fetchInvitations()
  }, [userId])

  useEffect(() => {
    fetchBirthdays()
  }, [])

  useEffect(() => {
    if (!filterScrollRef.current) return
    const pills = filterScrollRef.current.querySelectorAll('button')
    const currentMonthPill = pills[today.getMonth() + 1]
    if (currentMonthPill) {
      currentMonthPill.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
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

  async function handleAcceptInvitation(rsvpId) {
    const { error } = await supabase.from('rsvps').update({ status: 'going' }).eq('id', rsvpId)
    if (!error) {
      setInvitations(prev => prev.filter(i => i.id !== rsvpId))
    }
  }

  async function handleDeclineInvitation(rsvpId) {
    const { error } = await supabase.from('rsvps').update({ status: 'declined' }).eq('id', rsvpId)
    if (!error) {
      setInvitations(prev => prev.filter(i => i.id !== rsvpId))
    }
  }

  async function handleShare() {
    const shareData = {
      title: 'Amiv',
      text: 'Rejoins-moi sur Amiv pour ne plus jamais rater un anniversaire 🎂',
      url: 'https://amiv.app',
    }
    if (navigator.share) {
      navigator.share(shareData).catch(() => {})
    } else {
      try { await navigator.clipboard.writeText('https://amiv.app') } catch { /* ignore */ }
      setToast({ message: 'Lien copié !', isError: false })
      setTimeout(() => setToast(null), 2000)
    }
  }

  const greeting = getGreeting()
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const currentMonth = today.getMonth()
  const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const birthdaysThisMonth = birthdays.filter(b =>
    parseInt(b.birthdate.split('-')[1], 10) - 1 === currentMonth
  )
  const heroBirthday = birthdaysThisMonth[0] ?? null

  const displayedBirthdays = (() => {
    if (birthdayFilter === 'Tous') return birthdays
    const monthIdx = MONTH_LABELS.indexOf(birthdayFilter)
    return birthdays
      .filter(b => parseInt(b.birthdate.split('-')[1], 10) - 1 === monthIdx)
      .sort((a, b) => parseInt(a.birthdate.split('-')[2], 10) - parseInt(b.birthdate.split('-')[2], 10))
  })()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden', position: 'relative' }}>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, padding: '6px 2px 0' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>{greeting}</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{dateStr}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <NotificationBell onEventClick={onNotifEventClick ?? onEventClick} />
          </div>
        </div>

        {invitations.length > 0 && (
          <>
            <SectionHeader title="Invitations en attente" badge={invitations.length} />
            {invitations.map(inv => {
              const ev = inv.events ?? {}
              const dateStr = ev.date
                ? new Date(ev.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                : ''
              return (
                <div key={inv.id} style={{
                  background: '#fff', borderRadius: 16, padding: '14px',
                  marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', marginBottom: 2 }}>{ev.name ?? 'Événement'}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 10 }}>
                    {dateStr}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleAcceptInvitation(inv.id)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                        color: '#fff', fontSize: 13, fontWeight: 700,
                      }}
                    >
                      J'y serai ✓
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(inv.id)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: '#E5E5EA', color: '#3A3A3C', fontSize: 13, fontWeight: 600,
                      }}
                    >
                      Décliner ✗
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        <HeroBirthdayCard
          birthday={heroBirthday}
          onCreateEvent={onCreateClick}
          onMessage={onMessagesClick}
        />

        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Anniversaires
          </span>
        </div>
        <style>{`[data-birthday-filter]::-webkit-scrollbar { display: none; }`}</style>
        <div
          ref={filterScrollRef}
          data-birthday-filter
          style={{
            display: 'flex', gap: 6, overflowX: 'scroll', marginBottom: 12,
            scrollbarWidth: 'none', msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch', padding: '2px 0 4px',
          }}
        >
          {['Tous', ...MONTH_LABELS].map(opt => {
            const isActive = birthdayFilter === opt
            return (
              <button
                key={opt}
                onClick={() => setBirthdayFilter(opt)}
                style={{
                  flexShrink: 0, padding: '5px 14px', borderRadius: 20, border: 'none',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: isActive ? 'linear-gradient(135deg,#e055aa,#f5a623)' : 'white',
                  color: isActive ? '#fff' : '#8E8E93',
                  boxShadow: isActive ? '0 2px 8px rgba(224,85,170,0.30)' : '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
        <BirthdayStrip birthdays={displayedBirthdays} onRefetch={fetchBirthdays} onToast={showToast} />
        <MonthTimeline birthdays={birthdaysThisMonth} events={[]} today={today} onAddAmiv={() => setShowAddAmiv(true)} />

        {pendingRequests.length > 0 && (
          <>
            <SectionHeader title="Demandes d'amitié" badge={pendingRequests.length} />
            <FriendRequests requests={pendingRequests} onAccept={acceptRequest} onDecline={declineRequest} />
          </>
        )}

        {suggestions.length > 0 && (
          <>
            <SectionHeader title="Suggestions" />
            <FriendSuggestions suggestions={suggestions} onAdd={sendRequest} />
          </>
        )}

        <InviteCard onShare={handleShare} />

      </div>

      {showAddAmiv && (
        <AddAmivModal
          onClose={() => setShowAddAmiv(false)}
          onSaved={fetchBirthdays}
          onToast={showToast}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: 16, right: 16, zIndex: 400,
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
