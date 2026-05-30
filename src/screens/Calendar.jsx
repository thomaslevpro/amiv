import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import EventCard from '../components/EventCard'

const DAY_LABELS = ['LUN', 'MA.', 'ME.', 'JEU', 'VEN', 'SA.', 'DIM']
const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'
const PAGE_BG = 'linear-gradient(180deg, #fdf6ff 0%, #fff8f2 50%, #fafafa 100%)'

function toYMD(date) {
  return date.toISOString().split('T')[0]
}

function safeYMD(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  return toYMD(date)
}

function titleCase(value, fallback = 'Événement') {
  const text = (value || fallback).trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function normalizeRsvpStatus(status) {
  if (status === 'going' || status === 'accepted' || status === 'confirmed') return 'yes'
  if (status === 'not_going' || status === 'declined') return 'no'
  if (status === 'maybe' || status === 'invited' || status === 'pending') return 'maybe'
  return status || null
}

function countStatuses(rows = []) {
  return rows.reduce((acc, row) => {
    const status = normalizeRsvpStatus(row.status || row.response)
    if (status === 'yes') acc.yes += 1
    else if (status === 'no') acc.no += 1
    else acc.maybe += 1
    return acc
  }, { yes: 0, no: 0, maybe: 0 })
}

function formatEventDate(dateStr) {
  if (!dateStr) return 'Date à préciser'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Date à préciser'
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  return hasTime ? `${datePart} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : datePart
}

function CalendarBottomSheet({ isOpen, onClose, currentMonth, onPrevMonth, onNextMonth, calendarDots, selectedDate, onSelectDate }) {
  const todayStr = toYMD(new Date())

  const dotMap = {}
  calendarDots.forEach(({ event_date, dot_type }) => {
    if (!dotMap[event_date]) dotMap[event_date] = new Set()
    dotMap[event_date].add(dot_type)
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const monthLabel = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 11 : month - 1
  const nextYear = month === 11 ? year + 1 : year
  const nextMonth = month === 11 ? 0 : month + 1

  const cells = []
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, year: prevYear, month: prevMonth, isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, year, month, isCurrentMonth: true })
  const trailing = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= trailing; d++) cells.push({ day: d, year: nextYear, month: nextMonth, isCurrentMonth: false })

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,10,12,0.42)',
          zIndex: 200,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderRadius: '28px 28px 0 0',
          padding: '10px 18px 38px',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
          boxShadow: '0 -20px 60px rgba(28,28,30,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: '#D8D8DD' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <IconButton onClick={onPrevMonth} label="Mois précédent"><ChevronLeft size={18} /></IconButton>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#1C1C1E', textTransform: 'capitalize' }}>
            {monthLabel}
          </span>
          <IconButton onClick={onNextMonth} label="Mois suivant"><ChevronRight size={18} /></IconButton>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
          {DAY_LABELS.map(label => (
            <div key={label} style={{ textAlign: 'center', fontSize: 10, color: '#9A9AA2', fontWeight: 800 }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 3 }}>
          {cells.map(({ day, year: cy, month: cm, isCurrentMonth }, i) => {
            const dateStr = `${cy}-${String(cm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const types = isCurrentMonth ? (dotMap[dateStr] ?? new Set()) : new Set()

            return (
              <button
                key={`${dateStr}-${i}`}
                onClick={() => isCurrentMonth && onSelectDate(dateStr)}
                style={{
                  height: 45,
                  opacity: isCurrentMonth ? 1 : 0.28,
                  cursor: isCurrentMonth ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 14,
                  fontWeight: isSelected || isToday ? 800 : 500,
                  color: isSelected ? '#fff' : '#1C1C1E',
                  background: isSelected ? GRADIENT : isToday ? '#fff' : 'transparent',
                  border: isToday && !isSelected ? '1.5px solid #1C1C1E' : '1.5px solid transparent',
                  boxShadow: isSelected ? '0 8px 18px rgba(224,85,170,0.24)' : 'none',
                }}>
                  {day}
                </span>
                <span style={{ height: 6, display: 'flex', alignItems: 'center', gap: 2, marginTop: 1 }}>
                  {types.has('invited') && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#e055aa' }} />}
                  {types.has('own') && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#007AFF' }} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}

function IconButton({ children, onClick, label, dark = false, style }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        display: 'grid',
        placeItems: 'center',
        color: dark ? '#fff' : '#1C1C1E',
        background: dark ? '#1C1C1E' : '#fff',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'transform 0.16s ease, background 0.16s ease',
        ...style,
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)' }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {children}
    </button>
  )
}

function SectionPlaceholder({ label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '14px 4px 18px',
      color: '#9A9AA2',
      fontSize: 13,
      fontWeight: 700,
    }}>
      <span style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        background: '#fff',
        border: '0.5px solid rgba(0,0,0,0.08)',
        display: 'grid',
        placeItems: 'center',
      }}>
        <Plus size={15} />
      </span>
      Aucun événement {label.toLowerCase()}.
    </div>
  )
}

function WeekStrip({ weekOffset, setWeekOffset, selectedDate, setSelectedDate, calendarDots, onOpenCalendar }) {
  const today = new Date()

  // Premier lundi de la semaine courante + offset
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const dotMap = {}
  ;(calendarDots || []).forEach(({ event_date, dot_type }) => {
    if (!dotMap[event_date]) dotMap[event_date] = new Set()
    dotMap[event_date].add(dot_type)
  })

  const monthLabel = monday.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div style={{
      padding: '10px 16px 6px',
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 18,
      marginBottom: 12,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke="#1C1C1E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button onClick={onOpenCalendar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1C1C1E', textTransform: 'capitalize' }}>
          {monthLabel} ▾
        </button>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F2F7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="#1C1C1E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((d, i) => {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const types = dotMap[dateStr] ?? new Set()
          return (
            <div
              key={i}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                gap: 4,
                paddingBottom: 6,
                paddingTop: 4,
                cursor: 'pointer',
                borderRadius: 14,
                transition: 'background 0.15s ease',
              }}
            >
              <span style={{ fontSize: 10, color: isSelected ? '#e055aa' : '#9A9AA2', fontWeight: 600 }}>{DAY_LETTERS[i]}</span>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                color: isSelected ? '#fff' : '#1C1C1E',
                background: isSelected ? GRADIENT : 'transparent',
                boxShadow: isSelected ? '0 4px 12px rgba(224,85,170,0.35)' : 'none',
                border: isToday && !isSelected ? '1.5px solid #1C1C1E' : '1.5px solid transparent',
              }}>
                {d.getDate()}
              </div>
              <div style={{ height: 5, display: 'flex', gap: 2, alignItems: 'center' }}>
                {types.has('invited') && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#e055aa' }} />}
                {types.has('own') && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#007AFF' }} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Calendar({ onEventClick, onCreateClick, onMessagesClick }) {
  const navigate = useNavigate()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarDots, setCalendarDots] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [organizedEvents, setOrganizedEvents] = useState([])
  const [guestEvents, setGuestEvents] = useState([])
  const [rsvpsByEvent, setRsvpsByEvent] = useState({})
  const [publicRsvpsByEvent, setPublicRsvpsByEvent] = useState({})
  const [profilesById, setProfilesById] = useState({})
  const [loadingEvents, setLoadingEvents] = useState(true)

  const fetchCalendarDots = useCallback(async (monthDate) => {
    try {
      const year = monthDate.getFullYear()
      const month = monthDate.getMonth()
      const monthStart = toYMD(new Date(year, month, 1))
      const monthEnd = toYMD(new Date(year, month + 1, 0))
      const { data } = await supabase.rpc('get_calendar_dots', { month_start: monthStart, month_end: monthEnd })
      setCalendarDots(data || [])
    } catch (err) {
      console.error('Calendar dots error:', err)
    }
  }, [])

  const fetchUpcomingCalendarDots = useCallback(async () => {
    try {
      const today = new Date()
      const rangeEnd = new Date(today)
      rangeEnd.setDate(today.getDate() + 90)
      const { data } = await supabase.rpc('get_calendar_dots', {
        month_start: toYMD(today),
        month_end: toYMD(rangeEnd),
      })
      setCalendarDots(data || [])
    } catch (err) {
      console.error('Calendar dots error:', err)
    }
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCurrentUser(null)
      setLoadingEvents(false)
      return
    }

    const eventSelect = 'id, name, emoji, date, location, type, visibility, user_id, invite_token, cover_image'
    const [organizedRes, guestRes] = await Promise.all([
      supabase.from('events').select(eventSelect).eq('user_id', user.id).order('date', { ascending: true }),
      supabase
        .from('invitations')
        .select(`status, events(${eventSelect})`)
        .eq('invited_user_id', user.id)
        .neq('status', 'declined'),
    ])

    const organized = organizedRes.data ?? []
    const guests = (guestRes.data ?? []).filter(item => item.events)

    console.log('[CALENDAR PARTICIPE] Query: invitations WHERE invited_user_id =', user.id, 'AND status != declined')
    console.log('[CALENDAR PARTICIPE] guestRes raw:', guestRes.data, guestRes.error)
    console.log('[CALENDAR PARTICIPE] guests après filtre item.events:', guests)

    const allEvents = [...organized, ...guests.map(item => item.events)]
    const eventIds = [...new Set(allEvents.map(event => event.id).filter(Boolean))]

    let memberRows = []
    let publicRows = []
    if (eventIds.length > 0) {
      const [rsvpRes, publicRes] = await Promise.all([
        supabase.from('rsvps').select('event_id, user_id, status').in('event_id', eventIds),
        supabase.from('public_rsvps').select('event_id, status').in('event_id', eventIds),
      ])

      console.log('[CALENDAR PARTICIPE] Query: rsvps WHERE event_id IN', eventIds)
      console.log('[CALENDAR PARTICIPE] rsvpRes raw:', rsvpRes.data, rsvpRes.error)

      memberRows = rsvpRes.data ?? []
      publicRows = publicRes.data ?? []

      if (publicRes.error) {
        const { data: guestRows } = await supabase
          .from('guest_rsvps')
          .select('event_id, response')
          .in('event_id', eventIds)
        publicRows = (guestRows ?? []).map(row => ({ event_id: row.event_id, status: row.response }))
      }
    }

    const userIds = [...new Set(memberRows.map(row => row.user_id).filter(Boolean))]
    let profileMap = {}
    if (userIds.length > 0) {
      const { data: rsvpProfiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, avatar_url, email')
        .in('id', userIds)
      profileMap = Object.fromEntries((rsvpProfiles ?? []).map(row => [row.id, row]))
    }

    setCurrentUser(user)
    setOrganizedEvents(organized)
    const sortedGuests = guests.sort((a, b) => new Date(a.events.date || '9999-12-31') - new Date(b.events.date || '9999-12-31'))
    console.log('[CALENDAR PARTICIPE] guestEvents final (status invitation + event):', sortedGuests.map(g => ({ status: g.status, event_id: g.events?.id, event_name: g.events?.name })))
    setGuestEvents(sortedGuests)
    setRsvpsByEvent(groupByEvent(memberRows))
    setPublicRsvpsByEvent(groupByEvent(publicRows))
    setProfilesById(profileMap)
    setLoadingEvents(false)
  }, [])

  useEffect(() => { fetchUpcomingCalendarDots() }, [fetchUpcomingCalendarDots])
  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    if (document.getElementById('amiv-calendar-anim')) return
    const style = document.createElement('style')
    style.id = 'amiv-calendar-anim'
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `
    document.head.appendChild(style)
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    const today = new Date()
    const selected = new Date(selectedDate)
    const todayMonday = new Date(today)
    todayMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const selectedMonday = new Date(selected)
    selectedMonday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7))
    const diffMs = selectedMonday - todayMonday
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diffWeeks)
  }, [selectedDate])

  function groupByEvent(rows) {
    return rows.reduce((acc, row) => {
      if (!row.event_id) return acc
      if (!acc[row.event_id]) acc[row.event_id] = []
      acc[row.event_id].push(row)
      return acc
    }, {})
  }

  const items = useMemo(() => {
    const userId = currentUser?.id
    const organized = organizedEvents.map(event => {
      const memberRows = rsvpsByEvent[event.id] ?? []
      const publicRows = publicRsvpsByEvent[event.id] ?? []
      const memberStats = countStatuses(memberRows)
      const publicStats = countStatuses(publicRows)
      const stats = {
        yes: memberStats.yes + publicStats.yes,
        no: memberStats.no + publicStats.no,
        maybe: memberStats.maybe + publicStats.maybe,
      }
      return buildItem({
        event,
        filter: 'organizer',
        isOrganizer: true,
        myStatus: 'organizer',
        stats,
        memberProfiles: memberRows.map(row => profilesById[row.user_id]).filter(Boolean),
      })
    })

    const guests = guestEvents.map(item => {
      const event = item.events
      const memberRows = rsvpsByEvent[event.id] ?? []
      const publicRows = publicRsvpsByEvent[event.id] ?? []
      const mine = memberRows.find(row => row.user_id === userId)
      const myStatus = normalizeRsvpStatus(mine?.status || item.status)
      const memberStats = countStatuses(memberRows)
      const publicStats = countStatuses(publicRows)
      const stats = {
        yes: memberStats.yes + publicStats.yes,
        no: memberStats.no + publicStats.no,
        maybe: memberStats.maybe + publicStats.maybe,
      }
      return buildItem({
        event,
        filter: myStatus === 'yes' ? 'going' : 'pending',
        isOrganizer: false,
        myStatus,
        stats,
        memberProfiles: memberRows.map(row => profilesById[row.user_id]).filter(Boolean),
        invitationStatus: item.status,
      })
    })

    return [...organized, ...guests].sort((a, b) => new Date(a.event.date || '9999-12-31') - new Date(b.event.date || '9999-12-31'))
  }, [organizedEvents, guestEvents, rsvpsByEvent, publicRsvpsByEvent, profilesById, currentUser?.id])

  function buildItem({ event, filter, isOrganizer, myStatus, stats, memberProfiles, invitationStatus }) {
    const date = event.date ? new Date(event.date) : null
    const isPast = date ? date <= new Date() : false
    return {
      id: `${isOrganizer ? 'org' : 'guest'}-${event.id}`,
      event,
      filter,
      isOrganizer,
      myStatus,
      stats,
      memberProfiles,
      invitationStatus,
      isPast,
      title: titleCase(event.name, 'Amiv'),
      location: titleCase(event.location, 'Lieu à définir'),
      type: titleCase(event.type, 'Social'),
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter(item => {
      const matchesDate = !selectedDate || item.event.date?.startsWith(selectedDate)
      return matchesDate
    })
  }, [items, selectedDate])

  const upcomingItems = useMemo(() => visibleItems.filter(item => !item.isPast), [visibleItems])
  const pastItems = useMemo(() => visibleItems.filter(item => item.isPast), [visibleItems])

  function openEvent(event) {
    if (onEventClick) onEventClick(event)
    else navigate(`/events/${event.id}`)
  }

  function manageEvent(event) {
    if (event?.id) navigate(`/events/${event.id}/organizer-space`)
  }

  function openChat(event) {
    if (onMessagesClick) onMessagesClick(event)
    else if (event?.id) navigate(`/events/${event.id}`)
  }

  async function shareEvent(event) {
    const token = event.invite_token || event.share_token
    const url = token ? `${window.location.origin}/invite/${token}` : `${window.location.origin}/events/${event.id}`
    const text = `Tu es invité(e) ! Rejoins l'événement sur Amiv : ${url}`
    if (navigator.share) {
      navigator.share({ title: event.name || 'Amiv', text, url }).catch(() => {})
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    }
  }

  async function handleRsvp(item, status) {
    if (!currentUser?.id) return
    const invitationStatus = status === 'yes' ? 'accepted' : status === 'no' ? 'declined' : 'maybe'

    const { data: inv } = await supabase
      .from('invitations')
      .select('id')
      .eq('event_id', item.event.id)
      .eq('invited_user_id', currentUser.id)
      .maybeSingle()

    if (inv?.id) {
      await supabase.from('invitations').update({ status: invitationStatus }).eq('id', inv.id)
    }

    const { error } = await supabase
      .from('rsvps')
      .upsert({ event_id: item.event.id, user_id: currentUser.id, status }, { onConflict: 'event_id,user_id' })

    if (!error) {
      setRsvpsByEvent(prev => {
        const rows = prev[item.event.id] ?? []
        const exists = rows.some(row => row.user_id === currentUser.id)
        const nextRow = { event_id: item.event.id, user_id: currentUser.id, status }
        return {
          ...prev,
          [item.event.id]: exists
            ? rows.map(row => row.user_id === currentUser.id ? nextRow : row)
            : [...rows, nextRow],
        }
      })
      setGuestEvents(prev => prev.map(row => row.events?.id === item.event.id ? { ...row, status: invitationStatus } : row))
    }
  }

  function handlePrevMonth() {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    setCurrentMonth(next)
    fetchCalendarDots(next)
  }

  function handleNextMonth() {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(next)
    fetchCalendarDots(next)
  }

  function renderSection(label, sectionItems) {
    return (
      <section style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#B0B0BA',
          margin: '16px 4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>{label}</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)', borderRadius: 1 }} />
        </div>
        {sectionItems.length === 0 ? (
          <SectionPlaceholder label={label} />
        ) : (
          sectionItems.map((item, index) => (
            <div
              key={item.id}
              style={{
                borderRadius: 22,
                overflow: 'hidden',
                marginBottom: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                animationName: 'fadeInUp',
                animationDuration: '0.4s',
                animationFillMode: 'both',
                animationTimingFunction: 'ease',
                animationDelay: `${index * 0.08}s`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
              }}
            >
              <EventCard
                item={item}
                currentUser={currentUser}
                onOpen={openEvent}
                onManage={manageEvent}
                onChat={openChat}
                onShare={shareEvent}
                onRsvp={handleRsvp}
              />
            </div>
          ))
        )}
      </section>
    )
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: PAGE_BG,
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 106px' }}>
        <header style={{ padding: '0 2px 12px' }}>
          <div style={{ padding: '18px 22px 22px' }}>
            <h1 style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: '#1C1C1E',
              letterSpacing: -0.5,
              lineHeight: 1.15,
            }}>
              L'essentiel, c'est d'être{' '}
              <span style={{
                background: GRADIENT,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>ensemble</span>
            </h1>
          </div>

          <button
            onClick={() => onCreateClick?.()}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.015)'
              e.currentTarget.style.boxShadow = '0 18px 38px rgba(224,85,170,0.34)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 14px 32px rgba(224,85,170,0.28)'
            }}
            style={{
              width: '100%',
              minHeight: 68,
              borderRadius: 20,
              background: GRADIENT,
              color: '#fff',
              padding: '13px 14px',
              display: 'grid',
              gridTemplateColumns: '38px 1fr 22px',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 14px 32px rgba(224,85,170,0.28)',
              textAlign: 'left',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <span style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              background: 'rgba(255,255,255,0.22)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Plus size={22} strokeWidth={2.5} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 900, lineHeight: 1.15 }}>
                Créer un événement
              </span>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, opacity: 0.84, marginTop: 3 }}>
                Anniversaire, soirée, apéro…
              </span>
            </span>
            <ChevronRight size={21} strokeWidth={2.5} />
          </button>

        </header>

        <WeekStrip
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          calendarDots={calendarDots}
          onOpenCalendar={() => setIsCalendarOpen(true)}
        />

        <CalendarBottomSheet
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          currentMonth={currentMonth}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          calendarDots={calendarDots}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date)
            setIsCalendarOpen(false)
          }}
        />

        <main style={{ paddingTop: 8 }}>
          {loadingEvents ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  height: 200,
                  borderRadius: 22,
                  background: 'linear-gradient(90deg, #f0f0f5 25%, #fafafa 50%, #f0f0f5 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease infinite',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }} />
              ))}
            </div>
          ) : (
            <>
              {renderSection('À venir', upcomingItems)}
              {renderSection('Passés', pastItems)}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
