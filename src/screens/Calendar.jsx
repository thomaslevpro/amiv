import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DAY_LABELS = ['LUN', 'MA.', 'ME.', 'JEU', 'VEN', 'SA.', 'DIM']

function toYMD(date) {
  return date.toISOString().split('T')[0]
}

function daysLeft(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function prenom(fullName) {
  return fullName?.split(' ')[0] || 'Quelqu\'un'
}

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
  const h = d.getHours()
  const m = d.getMinutes()
  const hasTime = h !== 0 || m !== 0
  if (!hasTime) return datePart
  return `${datePart} · ${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
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
    cells.push({ day: daysInPrevMonth - i, year: prevYear, month: prevMonth, isCurrentMonth: false })
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

function CalendarTrigger({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: '50%', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1.5" y="3" width="15" height="13.5" rx="2.5" stroke="white" strokeWidth="1.6" />
        <path d="M1.5 7.5h15" stroke="white" strokeWidth="1.6" />
        <path d="M5.5 1.5v3M12.5 1.5v3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  )
}

export default function Calendar() {
  const navigate = useNavigate()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarDots, setCalendarDots] = useState([])
  const [myEvent, setMyEvent] = useState(null)
  const [myEventStats, setMyEventStats] = useState({ done: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [organizedEvents, setOrganizedEvents] = useState([])
  const [guestEvents, setGuestEvents] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const monthStart = toYMD(new Date(year, month, 1))
      const monthEnd = toYMD(new Date(year, month + 1, 0))
      const in90days = toYMD(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))

      const [dotsRes, myEventRes] = await Promise.all([
        supabase.rpc('get_calendar_dots', { month_start: monthStart, month_end: monthEnd }),
        supabase
          .from('events')
          .select('id, name, date, user_id')
          .eq('user_id', user.id)
          .eq('type', 'birthday')
          .maybeSingle()
      ])

      setCalendarDots(dotsRes.data || [])

      if (myEventRes.data) {
        setMyEvent(myEventRes.data)
        const { data: checklistData } = await supabase
          .from('checklist_items')
          .select('done')
          .eq('event_id', myEventRes.data.id)
        const total = checklistData?.length || 0
        const done = checklistData?.filter(i => i.done).length || 0
        setMyEventStats({ done, total })
      } else {
        setMyEvent(null)
      }
    } catch (err) {
      console.error('CalendarPage fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    let cancelled = false
    async function fetchEvents() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingEvents(false); return }

      const [organizedRes, guestRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, emoji, date, location, type')
          .eq('user_id', user.id)
          .order('date', { ascending: true }),
        supabase
          .from('invitations')
          .select('status, events(id, name, emoji, date, location, type)')
          .eq('invited_user_id', user.id)
          .neq('status', 'declined'),
      ])

      console.log('user id:', user?.id)
      console.log('organizedEvents result:', organizedRes.data, 'error:', organizedRes.error)
      console.log('guestEvents result:', guestRes.data, 'error:', guestRes.error)

      if (cancelled) return
      setOrganizedEvents(organizedRes.data ?? [])
      const sorted = (guestRes.data ?? [])
        .filter(item => item.events !== null)
        .sort((a, b) => new Date(a.events.date) - new Date(b.events.date))
      setGuestEvents(sorted)
      setLoadingEvents(false)
    }
    fetchEvents()
    return () => { cancelled = true }
  }, [])

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, padding: '6px 2px 0' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>Calendrier</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>Amivs &amp; anniversaires</div>
          </div>
          <CalendarTrigger onClick={() => setIsCalendarOpen(true)} />
        </div>

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

        {/* Section : Mes événements */}
        {(() => {
          const goingItems = guestEvents.filter(item => item.status === 'accepted')
          const pendingItems = guestEvents.filter(item => item.status !== 'accepted')

          const TABS = [
            { key: 'all',       label: 'Tous',          count: organizedEvents.length + guestEvents.length },
            { key: 'organizer', label: "J'organise",    count: organizedEvents.length },
            { key: 'guest',     label: "J'y participe", count: goingItems.length },
            { key: 'pending',   label: 'En attente',    count: pendingItems.length },
          ]

          const renderOrgCard = (event) => (
            <div key={event.id} onClick={() => navigate(`/events/${event.id}`)}
              style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', cursor: 'pointer' }}>
              <div style={{ height: 90, background: 'linear-gradient(135deg,rgba(224,85,170,0.10),rgba(245,166,35,0.10))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span style={{ fontSize: 40 }}>{event.emoji || '🎉'}</span>
              </div>
              <div style={{ padding: '11px 14px 13px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 3 }}>
                  {event.name ? event.name.charAt(0).toUpperCase() + event.name.slice(1) : 'Mon événement'}
                </div>
                {event.location && (
                  <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 5 }}>
                    {event.location.charAt(0).toUpperCase() + event.location.slice(1)}
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 7 }}>
                  {(() => { const d = new Date(event.date); return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })()}
                </div>
                {event.type && (
                  <div style={{ display: 'inline-block', border: '1px solid #E5E5EA', borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 500, color: '#8E8E93' }}>
                    {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                  </div>
                )}
              </div>
            </div>
          )

          const renderGuestCard = (item) => {
            const ev = item.events
            const rsvpChip = item.status === 'accepted'
              ? { label: "✓ J'y serai", bg: 'rgba(52,199,89,0.09)', color: '#1d7a38' }
              : { label: 'En attente', bg: '#F2F2F7', color: '#6B6B6B' }
            const displayName = ev.name ? ev.name.charAt(0).toUpperCase() + ev.name.slice(1) : 'Amiv'
            return (
              <div key={ev.id} onClick={() => navigate(`/events/${ev.id}`)}
                style={{ background: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', cursor: 'pointer' }}>
                <div style={{ height: 110, position: 'relative', background: 'linear-gradient(135deg, rgba(224,85,170,0.10), rgba(245,166,35,0.10))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 44 }}>{ev.emoji || '🎂'}</span>
                  <button onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e055aa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                </div>
                <div style={{ padding: '11px 14px 13px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 3 }}>{displayName}</div>
                  {ev.location && <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 5 }}>{ev.location}</div>}
                  <div style={{ fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg, #e055aa, #f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {formatEventDate(ev.date)}
                  </div>
                  {ev.type && (
                    <div style={{ display: 'inline-block', border: '1px solid #E5E5EA', borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 500, color: '#8E8E93', marginTop: 7 }}>
                      {ev.type}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(224,85,170,0.09)', color: '#72243E' }}>🔒 Espace secret</span>
                    <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: rsvpChip.bg, color: rsvpChip.color }}>{rsvpChip.label}</span>
                  </div>
                </div>
              </div>
            )
          }

          const emptyState = (
            <div style={{ textAlign: 'center', color: '#AEAEB2', fontSize: 14, padding: '20px 0' }}>
              Aucun événement pour l'instant
            </div>
          )

          let content = null
          if (!loadingEvents) {
            if (activeTab === 'all') {
              const merged = [
                ...organizedEvents.map(e => ({ _t: 'org', _d: e.date, data: e })),
                ...guestEvents.map(item => ({ _t: 'guest', _d: item.events?.date, data: item })),
              ].sort((a, b) => new Date(a._d) - new Date(b._d))
              content = merged.length === 0 ? emptyState : merged.map(item => item._t === 'org' ? renderOrgCard(item.data) : renderGuestCard(item.data))
            } else if (activeTab === 'organizer') {
              content = organizedEvents.length === 0 ? emptyState : organizedEvents.map(renderOrgCard)
            } else if (activeTab === 'guest') {
              content = goingItems.length === 0 ? emptyState : goingItems.map(renderGuestCard)
            } else {
              content = pendingItems.length === 0 ? emptyState : pendingItems.map(renderGuestCard)
            }
          }

          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 10, padding: '0 2px' }}>
                Mes événements
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {TABS.map(({ key, label, count }) => {
                  const isActive = activeTab === key
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{
                        flexShrink: 0,
                        padding: '8px 16px', borderRadius: 20, border: 'none',
                        cursor: 'pointer', fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        background: isActive ? '#1C1C1E' : '#F2F2F7',
                        color: isActive ? '#fff' : '#1C1C1E',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {label}{count > 0 ? ` (${count})` : ''}
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: 12 }}>{content}</div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
