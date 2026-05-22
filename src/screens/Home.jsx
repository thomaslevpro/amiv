import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import NotificationBell from '../components/NotificationBell'
import FriendRequests from '../components/FriendRequests'
import FriendSuggestions from '../components/FriendSuggestions'
import TrendingNow from '../components/TrendingNow'
import BirthdaySection from '../components/home/BirthdaySection'
import { useFriendships } from '../hooks/useFriendships'
import { supabase } from '../lib/supabase'

function getCoverUrl(coverImage) {
  if (!coverImage) return null
  if (coverImage.startsWith('http')) return coverImage
  return supabase.storage.from('event-covers').getPublicUrl(coverImage).data.publicUrl
}

const EVENT_GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'

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

function normalizeStatus(status) {
  if (status === 'going' || status === 'yes' || status === 'accepted' || status === 'confirmed') return 'yes'
  if (status === 'maybe' || status === 'invited' || status === 'pending') return 'maybe'
  if (status === 'declined' || status === 'no' || status === 'not_going') return 'no'
  return status || null
}

function countStatuses(rows = []) {
  return rows.reduce((acc, row) => {
    const status = normalizeStatus(row.status || row.response)
    if (status === 'yes') acc.yes += 1
    else if (status === 'no') acc.no += 1
    else acc.maybe += 1
    return acc
  }, { yes: 0, no: 0, maybe: 0 })
}

function MiniEventStatusChip({ item }) {
  const isOrganizer = item.role === 'organise'
  const normalized = normalizeStatus(item.myStatus)
  const chip = isOrganizer
    ? { label: "👑 J'organise", bg: 'rgba(224,85,170,0.10)', color: '#c0308a' }
    : normalized === 'yes'
      ? { label: "✓ J'y serai", bg: 'rgba(52,199,89,0.10)', color: '#1a8f3a' }
      : { label: 'En attente', bg: '#F2F2F7', color: '#8E8E93' }

  return (
    <span style={{
      padding: '3px 8px',
      borderRadius: 20,
      display: 'inline-flex',
      alignItems: 'center',
      background: chip.bg,
      color: chip.color,
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
    }}>
      {chip.label}
    </span>
  )
}

function MyEventMiniCard({ item, onClick }) {
  const daysLeft = getEventDaysLeft(item.date)
  const coverUrl = getCoverUrl(item.cover_image)
  const hasCover = !!coverUrl
  const dateStr = formatCompactEventDate(item.date)
  const stats = item.rsvpStats ?? { yes: 0, maybe: 0, no: 0 }

  return (
    <div
      onClick={() => onClick?.(item)}
      style={{
        width: 160,
        flexShrink: 0,
        background: '#fff',
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div style={{ height: 100, position: 'relative', background: hasCover ? '#000' : 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)', overflow: 'hidden' }}>
        {hasCover ? (
          <img src={coverUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : null}
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, textShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name || 'Événement'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dateStr}{item.location ? ` · ${item.location}` : ''}
          </div>
        </div>
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.92)',
          color: '#d4840a',
          fontSize: 10,
          fontWeight: 700,
          padding: '3px 8px',
          lineHeight: 1.15,
        }}>
          {daysLeft === null ? 'J-?' : `J-${Math.max(daysLeft, 0)}`}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10 }}>
        <MiniEventStatusChip item={item} />
        <span style={{ color: '#aaa', fontSize: 10, lineHeight: 1, whiteSpace: 'nowrap' }}>
          {stats.yes} oui
        </span>
      </div>
    </div>
  )
}

function CreateEventMiniCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 160,
        flexShrink: 0,
        minHeight: 160,
        border: '1.5px dashed #e0d8ea',
        background: 'transparent',
        borderRadius: 18,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        padding: 12,
        cursor: 'pointer',
      }}
    >
      <span style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        display: 'grid',
        placeItems: 'center',
        background: EVENT_GRADIENT,
      }}>
        <Plus size={20} color="#fff" strokeWidth={2.6} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#c0b0cc', textAlign: 'center' }}>
        Créer un événement
      </span>
    </button>
  )
}

function MyEventsSection({ events, onSeeAll, onEventClick, onCreateClick }) {
  return (
    <div style={{ margin: '0 -16px 12px' }}>
      <style>{`
        .home-my-events-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 18px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', letterSpacing: -0.3 }}>Mes événements</div>
        <button
          onClick={onSeeAll}
          style={{
            border: 'none',
            background: 'transparent',
            backgroundImage: EVENT_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: 13,
            fontWeight: 600,
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Voir tout
        </button>
      </div>
      <div
        className="home-my-events-scroll"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 12,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '4px 20px 8px',
        }}
      >
        {events.map(event => (
          <MyEventMiniCard
            key={event.id}
            item={event}
            onClick={onEventClick}
          />
        ))}
        <CreateEventMiniCard onClick={onCreateClick} />
      </div>
    </div>
  )
}

export default function Home({ onEventClick, onCreateClick, onNotifEventClick, onMessagesClick, onAllEventsClick, onCalendarClick, onTrendingClick, session }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const userId = session?.user?.id
  const userEmail = session?.user?.email
  const { suggestions, pendingRequests, sendRequest, acceptRequest, declineRequest } = useFriendships(userId)

  const [invitations, setInvitations] = useState([])
  const [myEvents, setMyEvents] = useState([])
  const [profileName, setProfileName] = useState('')
  const [toast, setToast] = useState(null)

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
      setProfileName('')
      return
    }

    supabase
      .from('profiles')
      .select('first_name, name, email')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.first_name || data?.name || data?.email?.split('@')[0] || '')
      })
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
          .select('id, name, date, location, user_id, cover_image')
          .eq('user_id', userId)
          .gte('date', now)
          .order('date', { ascending: true })
          .limit(5),
        supabase
          .from('invitations')
          .select('status, events(id, name, date, location, user_id, cover_image)')
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

      const eventIds = [...byId.keys()]
      let rsvpRows = []
      let profilesById = {}
      if (eventIds.length > 0) {
        const { data: rsvps } = await supabase
          .from('rsvps')
          .select('event_id, user_id, status')
          .in('event_id', eventIds)
        rsvpRows = rsvps ?? []
        const rsvpUserIds = [...new Set(rsvpRows.map(row => row.user_id).filter(Boolean))]
        if (rsvpUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, first_name, avatar_url, email')
            .in('id', rsvpUserIds)
          profilesById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
        }
      }

      const merged = [...byId.values()]
        .map(event => {
          const eventRsvps = rsvpRows.filter(row => row.event_id === event.id)
          const mine = eventRsvps.find(row => row.user_id === userId)
          return {
            ...event,
            myStatus: event.role === 'organise' ? 'going' : (mine?.status || event.status),
            rsvpStats: countStatuses(eventRsvps),
            memberProfiles: eventRsvps.map(row => profilesById[row.user_id]).filter(Boolean),
          }
        })
        .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'))
        .slice(0, 3)

      setMyEvents(merged)
    }

    fetchMyEvents()
    return () => { cancelled = true }
  }, [userId])

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

  const weekday = today.toLocaleDateString('fr-FR', { weekday: 'long' })
  const dateRest = today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const dateStr = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dateRest}`
  const displayName = profileName || session?.user?.user_metadata?.first_name || session?.user?.user_metadata?.name || userEmail?.split('@')[0] || 'toi'
  const amivCount = myEvents.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', overflow: 'hidden', position: 'relative' }}>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, padding: '6px 2px 0', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#aaa', fontWeight: 500, marginBottom: 10 }}>
              {dateStr}
            </div>
            <div style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 800, color: '#1C1C1E', letterSpacing: -0.5 }}>
              Bonjour {displayName},
              <br />
              vous avez{' '}
              <span style={{
                background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {amivCount} amiv{amivCount > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#aaa', fontWeight: 400, marginTop: 8 }}>
              à venir dans les 30 prochains jours
            </div>
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

        <BirthdaySection user={session?.user} onToast={showToast} onMessage={onMessagesClick} />

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
          onSeeAll={onAllEventsClick ?? onCalendarClick}
          onEventClick={onNotifEventClick ?? onEventClick}
          onCreateClick={onCreateClick}
        />

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', marginBottom: 12 }}>
            Trending now
          </div>
          <TrendingNow onCardClick={onTrendingClick} />
        </div>

        <InviteCard onShare={handleShare} />

      </div>

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
