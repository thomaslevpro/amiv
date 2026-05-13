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

function InviteCard({ onShare }) {
  return (
    <div
      onClick={onShare}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {['#e055aa', '#f5a623', '#4D96FF', '#6BCB77'].map(color => (
            <span key={color} style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
          ))}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginBottom: 3 }}>
          Offrez Amiv à vos proches
        </div>
        <div style={{ fontSize: 12, color: '#6B6B6D', lineHeight: 1.4 }}>
          Parce que les bons moments méritent d'être partagés
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onShare() }}
        style={{
          flexShrink: 0,
          padding: '10px 14px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #e055aa, #f5a623)',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
          whiteSpace: 'normal',
          width: 80,
          border: 'none',
          cursor: 'pointer',
          lineHeight: 1.15,
        }}
      >
        Envoyer<br />le lien
      </button>
    </div>
  )
}

function formatCompactEventDate(dateStr) {
  if (!dateStr) return 'Date à définir'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Date à définir'
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getEventDaysLeft(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
}

function MyEventCard({ item, onClick }) {
  const daysLeft = getEventDaysLeft(item.date)
  const badgeColor = daysLeft === null
    ? '#AEAEB2'
    : daysLeft < 14
      ? '#e055aa'
      : daysLeft < 60
        ? '#f5a623'
        : '#AEAEB2'
  const isOrganizer = item.role === 'organise'
  const meta = [formatCompactEventDate(item.date), item.location].filter(Boolean).join(' · ')

  return (
    <div
      onClick={() => onClick?.(item)}
      style={{
        background: '#fff',
        borderRadius: 16,
        marginBottom: 10,
        overflow: 'hidden',
        display: 'flex',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 4,
          flexShrink: 0,
          background: isOrganizer ? 'linear-gradient(to bottom, #e055aa, #f5a623)' : '#34C759',
        }}
      />
      <div style={{ flex: 1, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'rgba(224,85,170,0.08)',
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.emoji || '🎉'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#1C1C1E',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name || 'Événement'}
          </div>
          <div style={{ fontSize: 12, color: '#6B6B6D', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: badgeColor }}>
            {daysLeft === null ? 'J-?' : `J-${Math.max(daysLeft, 0)}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOrganizer ? '#e055aa' : '#34C759' }} />
            <span style={{ fontSize: 10, color: '#AEAEB2', whiteSpace: 'nowrap' }}>
              {isOrganizer ? "J'organise" : "J'y serai"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MyEventsSection({ events, onSeeAll, onEventClick }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Mes événements</div>
        <button
          onClick={onSeeAll}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#e055aa',
            fontSize: 13,
            fontWeight: 600,
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Voir tout
        </button>
      </div>
      {events.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📅</div>
          <div style={{ fontSize: 13, color: '#8E8E93' }}>Aucun événement à venir</div>
        </div>
      ) : (
        events.map(event => <MyEventCard key={event.id} item={event} onClick={onEventClick} />)
      )}
    </div>
  )
}

export default function Home({ onEventClick, onCreateClick, onNotifEventClick, onMessagesClick, onAllEventsClick, onCalendarClick, session }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const userId = session?.user?.id
  const userEmail = session?.user?.email
  const { suggestions, pendingRequests, sendRequest, acceptRequest, declineRequest } = useFriendships(userId)

  const [invitations, setInvitations] = useState([])
  const [myEvents, setMyEvents] = useState([])
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
    if (!userId) {
      setMyEvents([])
      return
    }

    let cancelled = false

    async function fetchMyEvents() {
      const now = new Date().toISOString()
      const [organizedRes, invitationsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, emoji, date, location')
          .eq('user_id', userId)
          .gte('date', now)
          .order('date', { ascending: true })
          .limit(5),
        supabase
          .from('invitations')
          .select('status, events(id, name, emoji, date, location)')
          .eq('invited_user_id', userId)
          .neq('status', 'declined')
      ])

      if (cancelled) return

      if (organizedRes.error) console.error('Erreur événements organisés :', organizedRes.error)
      if (invitationsRes.error) console.error('Erreur invitations événements participés :', invitationsRes.error)

      const guestEvents = (invitationsRes.data ?? [])
        .filter(item => item.events)
        .map(item => ({
          ...item.events,
          role: 'participe',
        }))

      const byId = new Map()
      ;(organizedRes.data ?? []).filter(event => !event.date || new Date(event.date) >= new Date()).forEach(event => {
        if (event?.id) byId.set(event.id, { ...event, role: 'organise' })
      })
      guestEvents.filter(event => !event.date || new Date(event.date) >= new Date(now)).forEach(event => {
        if (event?.id && !byId.has(event.id)) byId.set(event.id, event)
      })

      const merged = [...byId.values()]
        .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'))
        .slice(0, 3)

      setMyEvents(merged)
    }

    fetchMyEvents()
    return () => { cancelled = true }
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

  async function handleAcceptInvitation(rsvpId, eventId) {
    const orParts = [`invited_user_id.eq.${userId}`]
    if (userEmail) orParts.push(`invited_email.eq.${userEmail}`)
    const { count } = await supabase
      .from('invitations')
      .update({ status: 'going' }, { count: 'exact' })
      .eq('event_id', eventId)
      .or(orParts.join(','))
    if (count === 0) console.warn('RSVP update matched 0 rows — check invited_user_id or email match')

    const { error } = await supabase.from('rsvps').update({ status: 'going' }).eq('id', rsvpId)
    if (!error) {
      setInvitations(prev => prev.filter(i => i.id !== rsvpId))
    }
  }

  async function handleDeclineInvitation(rsvpId, eventId) {
    const orParts = [`invited_user_id.eq.${userId}`]
    if (userEmail) orParts.push(`invited_email.eq.${userEmail}`)
    const { count } = await supabase
      .from('invitations')
      .update({ status: 'declined' }, { count: 'exact' })
      .eq('event_id', eventId)
      .or(orParts.join(','))
    if (count === 0) console.warn('RSVP update matched 0 rows — check invited_user_id or email match')

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
                      onClick={() => handleAcceptInvitation(inv.id, inv.event_id)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                        color: '#fff', fontSize: 13, fontWeight: 700,
                      }}
                    >
                      J'y serai ✓
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(inv.id, inv.event_id)}
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

        <MyEventsSection
          events={myEvents}
          onSeeAll={onCalendarClick ?? onAllEventsClick}
          onEventClick={onNotifEventClick ?? onEventClick}
        />

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
