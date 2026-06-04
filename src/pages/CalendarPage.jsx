import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import EventCard from '../components/EventCard'

const formatDate = (d) => d.toISOString().split('T')[0]

const DAY_LABELS = ['LUN', 'MA.', 'ME.', 'JEU', 'VEN', 'SA.', 'DIM']
const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'

const parseDateStr = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const formatLocalDate = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
)

const getWeekStart = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

function normalizeStatus(status) {
  if (status === 'going' || status === 'yes' || status === 'accepted' || status === 'confirmed' || status === 'organizing') return 'yes'
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

function CalendarBottomSheet({ isOpen, onClose, currentMonth, onPrevMonth, onNextMonth, calendarDots, selectedDate, onSelectDate }) {
  const today = new Date()
  const todayStr = formatDate(today)

  const dotMap = {}
  calendarDots.forEach(({ event_date, dot_type }) => {
    if (!dotMap[event_date]) dotMap[event_date] = new Set()
    dotMap[event_date].add(dot_type)
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const monthLabel = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // Monday-first offset: (getDay() + 6) % 7
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 11 : month - 1
  const nextYear = month === 11 ? year + 1 : year
  const nextMonth = month === 11 ? 0 : month + 1

  const cells = []
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    cells.push({ day, year: prevYear, month: prevMonth, isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, year, month, isCurrentMonth: true })
  }
  const trailing = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= trailing; d++) {
    cells.push({ day: d, year: nextYear, month: nextMonth, isCurrentMonth: false })
  }

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          padding: '10px 16px 40px',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            onClick={onPrevMonth}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}
          >
            <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
              <path d="M7.5 1.5L1.5 7.5L7.5 13.5" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 16, color: '#1C1C1E', textTransform: 'capitalize' }}>
            {monthLabel}
          </span>
          <button
            onClick={onNextMonth}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}
          >
            <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
              <path d="M1.5 1.5L7.5 7.5L1.5 13.5" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
          {cells.map(({ day, year: cy, month: cm, isCurrentMonth }, i) => {
            const dateStr = `${cy}-${String(cm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const types = isCurrentMonth ? (dotMap[dateStr] ?? new Set()) : new Set()
            const hasInvited = types.has('invited')
            const hasOwn = types.has('own')

            return (
              <div
                key={i}
                onClick={() => isCurrentMonth && onSelectDate(dateStr)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', height: 44,
                  opacity: isCurrentMonth ? 1 : 0.25,
                  cursor: isCurrentMonth ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: isSelected || isToday ? 600 : 400,
                  color: isSelected ? '#fff' : '#1C1C1E',
                  background: isSelected ? 'linear-gradient(135deg, #e055aa, #f5a623)' : 'transparent',
                  border: isToday && !isSelected ? '1.5px solid #1C1C1E' : '1.5px solid transparent',
                  boxSizing: 'border-box',
                }}>
                  {day}
                </div>
                <div style={{ height: 6, display: 'flex', alignItems: 'center', gap: 2, marginTop: 1 }}>
                  {hasInvited && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#e055aa' }} />}
                  {hasOwn && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#007AFF' }} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}

function WeekStrip({ currentMonth, setCurrentMonth, fetchDots, calendarDots, selectedDate, setSelectedDate, onOpenCalendar }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(selectedDate ? parseDateStr(selectedDate) : new Date()))
  const todayStr = formatLocalDate(new Date())

  const dotMap = {}
  calendarDots.forEach(({ event_date, dot_type }) => {
    if (!dotMap[event_date]) dotMap[event_date] = new Set()
    dotMap[event_date].add(dot_type)
  })

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })

  const displayMonth = new Date(weekStart)
  displayMonth.setDate(weekStart.getDate() + 3)
  const monthLabel = displayMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const syncMonth = useCallback((date) => {
    const nextMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    if (!sameMonth(nextMonth, currentMonth)) {
      setCurrentMonth(nextMonth)
      fetchDots(nextMonth)
    }
  }, [currentMonth, fetchDots, setCurrentMonth])

  const moveWeek = (direction) => {
    const nextStart = new Date(weekStart)
    nextStart.setDate(weekStart.getDate() + direction * 7)
    setWeekStart(nextStart)
    const nextDisplayMonth = new Date(nextStart)
    nextDisplayMonth.setDate(nextStart.getDate() + 3)
    syncMonth(nextDisplayMonth)
  }

  useEffect(() => {
    if (!selectedDate) return
    const selected = parseDateStr(selectedDate)
    setWeekStart(getWeekStart(selected))
    syncMonth(selected)
  }, [selectedDate, syncMonth])

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button
          onClick={() => moveWeek(-1)}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: 'none',
            background: '#F2F2F7',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
          aria-label="Semaine précédente"
        >
          <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
            <path d="M6.5 1.5L1.5 6.5L6.5 11.5" stroke="#1C1C1E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          onClick={onOpenCalendar}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            color: '#1C1C1E',
            textTransform: 'capitalize',
          }}
        >
          {monthLabel}
        </button>

        <button
          onClick={() => moveWeek(1)}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: 'none',
            background: '#F2F2F7',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
          aria-label="Semaine suivante"
        >
          <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
            <path d="M1.5 1.5L6.5 6.5L1.5 11.5" stroke="#1C1C1E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        {weekDays.map((date, index) => {
          const dateStr = formatLocalDate(date)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const showSelected = isSelected && !isToday
          const types = dotMap[dateStr] ?? new Set()
          const hasInvited = types.has('invited')
          const hasOwn = types.has('own')

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              style={{
                width: 36,
                height: 48,
                border: 'none',
                background: 'transparent',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                color: '#1C1C1E',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93', lineHeight: '13px' }}>
                {DAY_LABELS[index].charAt(0)}
              </span>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  marginTop: 1,
                  fontSize: 14,
                  fontWeight: isToday || showSelected ? 600 : 400,
                  color: isToday ? '#fff' : '#1C1C1E',
                  background: isToday ? GRADIENT : showSelected ? '#F2F2F7' : 'transparent',
                }}
              >
                {date.getDate()}
              </span>
              <span style={{ height: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 1 }}>
                {hasInvited && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#e055aa' }} />}
                {hasOwn && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#007AFF' }} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarPage({ navigate = () => {} }) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarDots, setCalendarDots] = useState([])
  const [invitedEvents, setInvitedEvents] = useState([])
  const [organizedEvents, setOrganizedEvents] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)

  const fetchDots = useCallback(async (month) => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const { data, error } = await supabase.rpc('get_calendar_dots', {
      month_start: formatDate(monthStart),
      month_end: formatDate(monthEnd),
    })
    if (error) { console.error(error); return }
    setCalendarDots(data ?? [])
  }, [])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const today = formatDate(now)
    const ninetyDaysLater = formatDate(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000))

    try {
      const [dotsResult, invitedResult, ownResult] = await Promise.all([
        supabase.rpc('get_calendar_dots', {
          month_start: formatDate(monthStart),
          month_end: formatDate(monthEnd),
        }),
        supabase
          .from('rsvps')
          .select('status, events!inner(id, name, date, user_id, location, type, cover_image, birthday_person_user_id, profiles!user_id(full_name))')
          .eq('user_id', user.id),
        supabase
          .from('events')
          .select('id, name, date, user_id, location, type, cover_image, birthday_person_user_id, profiles!user_id(full_name)')
          .eq('user_id', user.id)
          .gte('date', today)
          .lte('date', ninetyDaysLater)
          .order('date', { ascending: true }),
      ])

      if (dotsResult.error) throw dotsResult.error
      if (invitedResult.error) throw invitedResult.error
      if (ownResult.error) throw ownResult.error

      setCalendarDots(dotsResult.data ?? [])
      const mapped = (invitedResult.data || [])
        .filter(row => {
          if (!row.events) return false
          if (row.events.user_id === user.id) return false
          const normalized = normalizeStatus(row.status)
          if (normalized === 'no') return true
          return row.events.date >= today && row.events.date <= ninetyDaysLater
        })
        .map(row => ({ ...row.events, rsvpStatus: row.status }))
      const ownEvents = (ownResult.data ?? []).map(e => ({ ...e, rsvpStatus: 'organizing', isOrganizer: true }))
      const eventIds = [...new Set([...mapped, ...ownEvents].map(event => event.id).filter(Boolean))]
      let rsvpRows = []
      let profilesById = {}
      if (eventIds.length > 0) {
        const { data: rsvps } = await supabase
          .from('rsvps')
          .select('event_id, user_id, status')
          .in('event_id', eventIds)
        rsvpRows = rsvps ?? []
        const userIds = [...new Set(rsvpRows.map(row => row.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, first_name, full_name, avatar_url, email')
            .in('id', userIds)
          profilesById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
        }
      }
      const enrichEvent = event => {
        const eventRsvps = rsvpRows.filter(row => row.event_id === event.id)
        return {
          ...event,
          rsvpStats: countStatuses(eventRsvps),
          memberProfiles: eventRsvps.map(row => profilesById[row.user_id]).filter(Boolean),
        }
      }
      setInvitedEvents(mapped.map(enrichEvent))
      setOrganizedEvents(ownEvents.map(enrichEvent))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handlePrevMonth = useCallback(() => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    setCurrentMonth(prev)
    fetchDots(prev)
  }, [currentMonth, fetchDots])

  const handleNextMonth = useCallback(() => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(next)
    fetchDots(next)
  }, [currentMonth, fetchDots])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openEvent = useCallback((event) => {
    navigate(`/events/${event.id}`)
  }, [navigate])

  const manageEvent = useCallback((event) => {
    navigate(`/events/${event.id}/organizer-space`)
  }, [navigate])

  const openChat = useCallback((event) => {
    navigate(`/events/${event.id}`)
  }, [navigate])

  const shareEvent = useCallback(async (event) => {
    const url = `${window.location.origin}/events/${event.id}`
    const text = `Tu es invité(e) ! Rejoins l'événement sur Amiv : ${url}`
    if (navigator.share) {
      navigator.share({ title: event.name || 'Amiv', text, url }).catch(() => {})
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    }
  }, [])

  return (
    <div className="calendar-page">
      <WeekStrip
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        fetchDots={fetchDots}
        calendarDots={calendarDots}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
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

      {(() => {
        const goingEvents = invitedEvents.filter(e => e.rsvpStatus === 'going').sort((a, b) => a.date.localeCompare(b.date))
        const pendingEvents = invitedEvents.filter(e => e.rsvpStatus === 'invited').sort((a, b) => a.date.localeCompare(b.date))
        const declinedEvents = invitedEvents
          .filter(e => normalizeStatus(e.rsvpStatus) === 'no')
          .sort((a, b) => a.date.localeCompare(b.date))
        const allEventsMap = new Map()
        ;[...organizedEvents, ...invitedEvents].forEach(e => { if (!allEventsMap.has(e.id)) allEventsMap.set(e.id, e) })
        const allEvents = [...allEventsMap.values()].sort((a, b) => a.date.localeCompare(b.date))
        const bySelectedDate = events => selectedDate ? events.filter(event => event.date?.startsWith(selectedDate)) : events

        const TABS = [
          { key: 'all', label: 'Tous', events: bySelectedDate(allEvents) },
          { key: 'organizing', label: "J'organise", events: bySelectedDate(organizedEvents) },
          { key: 'going', label: "J'y participe", events: bySelectedDate(goingEvents) },
          { key: 'pending', label: 'En attente', events: bySelectedDate(pendingEvents) },
          { key: 'declined', label: 'Déclinés', events: bySelectedDate(declinedEvents) },
        ]
        const currentEvents = TABS.find(t => t.key === activeTab)?.events ?? []

        return (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flexShrink: 0,
                    background: activeTab === tab.key ? '#1C1C1E' : '#faf9fb',
                    color: activeTab === tab.key ? '#fff' : '#1C1C1E',
                    border: 'none',
                    borderRadius: 20,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {currentEvents.length > 0
              ? currentEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onOpen={openEvent}
                    onManage={manageEvent}
                    onChat={openChat}
                    onShare={shareEvent}
                  />
                ))
              : !loading && (
                  <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, marginTop: 32 }}>
                    Aucun événement
                  </div>
                )
            }
          </>
        )
      })()}
    </div>
  )
}
