import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

const DAY_LABELS = ['LUN', 'MA.', 'ME.', 'JEU', 'VEN', 'SA.', 'DIM']

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

function CalendarTrigger({ currentMonth, onClick }) {
  const monthLabel = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#fff',
        border: '1px solid #E5E5EA',
        borderRadius: 20,
        padding: '6px 12px 6px 10px',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        color: '#1C1C1E',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        marginBottom: 16,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2.5" width="14" height="12.5" rx="2.5" stroke="#1C1C1E" strokeWidth="1.4" />
        <path d="M1 6.5h14" stroke="#1C1C1E" strokeWidth="1.4" />
        <path d="M4.5 1v3M11.5 1v3" stroke="#1C1C1E" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ marginLeft: 1 }}>
        <path d="M1 1l3 3 3-3" stroke="#8E8E93" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function InvitedEventCard({ event, navigate }) {
  const firstName = event.profiles?.full_name?.split(' ')[0] ?? ''
  const status = event.rsvpStatus

  const rsvpChip = status === 'going'
    ? { label: "✓ J'y serai", bg: 'rgba(52,199,89,0.09)', color: '#1d7a38' }
    : status === 'organizing'
    ? { label: "✓ J'organise", bg: 'rgba(0,122,255,0.09)', color: '#0056CC' }
    : { label: 'En attente', bg: '#F2F2F7', color: '#6B6B6B' }

  const [datePart_str, timePart_str] = event.date.includes('T') ? event.date.split('T') : [event.date, null]
  const [y, mo, d] = datePart_str.split('-').map(Number)
  const dateObj = new Date(y, mo - 1, d)
  const dateFmt = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
  const timeFmt = timePart_str ? timePart_str.substring(0, 5).replace(':', 'h') : null
  const dateTimeLabel = timeFmt && timeFmt !== '00h00' ? `${dateFmt} · ${timeFmt}` : dateFmt

  const displayName = event.name
    ? event.name.charAt(0).toUpperCase() + event.name.slice(1)
    : `Amiv de ${firstName}`

  return (
    <div
      onClick={() => navigate(`/events/${event.id}/secret-space`)}
      style={{
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        height: 110,
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(224,85,170,0.10), rgba(245,166,35,0.10))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 44 }}>🎂</span>
        <button
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            background: 'rgba(255,255,255,0.85)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e055aa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '11px 14px 13px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 3 }}>
          {displayName}
        </div>

        {event.location && (
          <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 5 }}>
            {event.location}
          </div>
        )}

        <div style={{
          fontSize: 12,
          fontWeight: 600,
          background: 'linear-gradient(135deg, #e055aa, #f5a623)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {dateTimeLabel}
        </div>

        {event.type && (
          <div style={{
            display: 'inline-block',
            border: '1px solid #E5E5EA',
            borderRadius: 20,
            padding: '3px 9px',
            fontSize: 11,
            fontWeight: 500,
            color: '#8E8E93',
            marginTop: 7,
          }}>
            {event.type}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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
          .select('status, events!inner(id, name, date, user_id, location, type, profiles!user_id(full_name))')
          .eq('user_id', user.id),
        supabase
          .from('events')
          .select('id, name, date, user_id, location, type, profiles!user_id(full_name)')
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
        .filter(row => row.events && row.events.user_id !== user.id && row.events.date >= today && row.events.date <= ninetyDaysLater)
        .map(row => ({ ...row.events, rsvpStatus: row.status }))
      setInvitedEvents(mapped)
      setOrganizedEvents((ownResult.data ?? []).map(e => ({ ...e, rsvpStatus: 'organizing' })))
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
      <CalendarTrigger
        currentMonth={currentMonth}
        onClick={() => setIsCalendarOpen(true)}
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
        const allEventsMap = new Map()
        ;[...organizedEvents, ...invitedEvents].forEach(e => { if (!allEventsMap.has(e.id)) allEventsMap.set(e.id, e) })
        const allEvents = [...allEventsMap.values()].sort((a, b) => a.date.localeCompare(b.date))

        const TABS = [
          { key: 'all', label: 'Tous', events: allEvents },
          { key: 'organizing', label: "J'organise", events: organizedEvents },
          { key: 'going', label: "J'y participe", events: goingEvents },
          { key: 'pending', label: 'En attente', events: pendingEvents },
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
                    background: activeTab === tab.key ? '#1C1C1E' : '#F2F2F7',
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
                  <InvitedEventCard key={event.id} event={event} navigate={navigate} />
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
