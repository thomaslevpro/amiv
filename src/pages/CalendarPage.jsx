import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const formatDate = (d) => d.toISOString().split('T')[0]

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d) - today) / 86400000)
}

function frenchDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

const NAV_BTN = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 24,
  color: '#007AFF',
  padding: '0 6px',
  lineHeight: 1,
  fontWeight: 300,
}

function CalendarWidget({ currentMonth, onPrevMonth, onNextMonth, calendarDots }) {
  const today = new Date()
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')

  const dotMap = {}
  calendarDots.forEach(({ event_date, dot_type }) => {
    if (!dotMap[event_date]) dotMap[event_date] = new Set()
    dotMap[event_date].add(dot_type)
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 18,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      padding: 13,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button style={NAV_BTN} onClick={onPrevMonth}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#1C1C1E', textTransform: 'capitalize' }}>
          {monthLabel}
        </span>
        <button style={NAV_BTN} onClick={onNextMonth}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((label, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ height: 40 }} />

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const types = dotMap[dateStr] ?? new Set()
          const hasInvited = types.has('invited')
          const hasOwn = types.has('own')

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 40 }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: isToday ? 600 : 400,
                color: isToday ? '#fff' : '#1C1C1E',
                background: isToday ? 'linear-gradient(135deg, #e055aa, #f5a623)' : 'transparent',
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
  )
}

function ChevronRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M4 2L7.5 5.5L4 9" stroke="#AEAEB2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 12" fill="none">
      <rect x="1" y="5" width="8" height="7" rx="1.5" stroke="#72243E" strokeWidth="1.2" />
      <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="#72243E" strokeWidth="1.2" />
    </svg>
  )
}

function InvitedEventCard({ event, navigate }) {
  const firstName = event.profiles?.full_name?.split(' ')[0] ?? ''
  const days = daysUntil(event.date)
  const dateLabel = frenchDate(event.date)
  const status = event.rsvpStatus

  const rsvpChip = status === 'going'
    ? { label: "✓ J'y serai", bg: 'rgba(52,199,89,0.09)', color: '#1d7a38' }
    : { label: 'En attente', bg: '#F2F2F7', color: '#6B6B6B' }

  return (
    <div
      onClick={() => navigate(`/events/${event.id}/secret-space`)}
      style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', marginBottom: 10, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40,
          background: 'rgba(224,85,170,0.10)',
          borderRadius: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          🎂
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', marginBottom: 2 }}>
            Amiv de {firstName}
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dateLabel} · J-{days} · organisé par {firstName}
          </div>
        </div>
        <ChevronRight />
      </div>

      <div style={{ height: 1, background: '#F2F2F7', margin: '10px 0' }} />

      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(224,85,170,0.09)',
          borderRadius: 20, padding: '3px 8px',
          fontSize: 11, fontWeight: 600, color: '#72243E',
        }}>
          <LockIcon />
          Espace secret
        </div>
        <div style={{
          background: rsvpChip.bg,
          borderRadius: 20, padding: '3px 8px',
          fontSize: 11, fontWeight: 600, color: rsvpChip.color,
        }}>
          {rsvpChip.label}
        </div>
      </div>
    </div>
  )
}


export default function CalendarPage({ navigate = () => {} }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarDots, setCalendarDots] = useState([])
  const [invitedEvents, setInvitedEvents] = useState([])
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
      const [dotsResult, invitedResult] = await Promise.all([
        supabase.rpc('get_calendar_dots', {
          month_start: formatDate(monthStart),
          month_end: formatDate(monthEnd),
        }),
        supabase
          .from('rsvps')
          .select('status, events!inner(id, name, date, user_id, profiles!user_id(full_name))')
          .eq('user_id', user.id),
      ])

      if (dotsResult.error) throw dotsResult.error
      if (invitedResult.error) throw invitedResult.error

      setCalendarDots(dotsResult.data ?? [])
      const mapped = (invitedResult.data || [])
        .filter(row => row.events && row.events.user_id !== user.id && row.events.date >= today && row.events.date <= ninetyDaysLater)
        .map(row => ({ ...row.events, rsvpStatus: row.status }))
      setInvitedEvents(mapped)

      console.log('calendarDots', dotsResult.data)
      console.log('invitedEvents', invitedResult.data)
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

  return (
    <div className="calendar-page">
      <CalendarWidget
        currentMonth={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        calendarDots={calendarDots}
      />

      {invitedEvents.length > 0 && (
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', marginBottom: 12 }}>
            Invité à ces amivs
          </div>
          {invitedEvents.map((event) => (
            <InvitedEventCard key={event.id} event={event} navigate={navigate} />
          ))}
        </div>
      )}

    </div>
  )
}
