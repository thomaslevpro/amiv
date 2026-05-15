import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Image as ImageIcon } from 'lucide-react'
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

const DAY_LABELS = ['LUN', 'MA.', 'ME.', 'JEU', 'VEN', 'SA.', 'DIM']
const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'

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

function getCountdown(dateStr) {
  if (!dateStr) return { label: 'J-?', days: null }
  const eventDate = new Date(dateStr)
  if (Number.isNaN(eventDate.getTime())) return { label: 'J-?', days: null }
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startEvent = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
  const days = Math.ceil((startEvent - startToday) / 86400000)
  if (days < 0) return { label: 'Passé', days }
  if (days === 0) return { label: 'Jour J', days }
  return { label: `J-${days}`, days }
}

function getInitial(profile, fallback = 'I') {
  return (profile?.first_name || profile?.name || profile?.full_name || profile?.email || fallback || 'I').charAt(0).toUpperCase()
}

function GuestAvatars({ profiles, extraCount }) {
  const visible = profiles.slice(0, 3)
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((profile, index) => (
        <div
          key={`${profile.id || profile.email || index}`}
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            marginLeft: index === 0 ? 0 : -7,
            background: ['#e055aa', '#f5a623', '#34C759'][index % 3],
            border: '2px solid #fff',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 900,
            overflow: 'hidden',
          }}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : getInitial(profile)}
        </div>
      ))}
      {extraCount > 0 && (
        <div style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          marginLeft: visible.length ? -7 : 0,
          background: '#E5E5EA',
          border: '2px solid #fff',
          color: '#6B6B72',
          display: 'grid',
          placeItems: 'center',
          fontSize: 10,
          fontWeight: 900,
        }}>
          +{extraCount}
        </div>
      )}
    </div>
  )
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

function InvitedEventCard({ event, navigate, onCoverUploaded }) {
  const inputRef = useRef(null)
  const firstName = event.profiles?.full_name?.split(' ')[0] ?? ''
  const status = event.rsvpStatus
  const hasCover = !!event.cover_image
  const isOrganizer = status === 'organizing' || event.isOrganizer
  const countdown = getCountdown(event.date)
  const countdownColor = countdown.days === null
    ? '#AEAEB2'
    : countdown.days < 14
      ? '#e055aa'
      : countdown.days < 60
        ? '#f5a623'
        : '#AEAEB2'
  const rsvpChip = normalizeStatus(status) === 'yes'
    ? { label: "✓ J'y serai", bg: 'rgba(52,199,89,0.09)', color: '#1d7a38' }
    : { label: 'En attente', bg: '#F2F2F7', color: '#6B6B6B' }
  const stats = event.rsvpStats ?? { yes: 0, maybe: 0, no: 0 }
  const total = stats.yes + stats.maybe + stats.no
  const progress = total > 0 ? Math.round((stats.yes / total) * 100) : 0

  const dateValue = event.date || ''
  const [datePart_str, timePart_str] = dateValue.includes('T') ? dateValue.split('T') : [dateValue, null]
  const [y, mo, d] = datePart_str ? datePart_str.split('-').map(Number) : []
  const dateObj = y ? new Date(y, mo - 1, d) : null
  const dateFmt = dateObj ? dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }) : 'Date à définir'
  const timeFmt = timePart_str ? timePart_str.substring(0, 5).replace(':', 'h') : null
  const dateTimeLabel = timeFmt && timeFmt !== '00h00' ? `${dateFmt} · ${timeFmt}` : dateFmt

  const displayName = event.name
    ? event.name.charAt(0).toUpperCase() + event.name.slice(1)
    : `Amiv de ${firstName}`

  async function handleCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file || !event.id || !isOrganizer) return
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${event.id}/${Date.now()}.${ext}`
    try {
      const { error: uploadError } = await supabase.storage
        .from('event-covers')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('event-covers').getPublicUrl(path)
      const publicUrl = data.publicUrl
      const { error: updateError } = await supabase
        .from('events')
        .update({ cover_image: publicUrl })
        .eq('id', event.id)
      if (updateError) throw updateError
      onCoverUploaded?.(event.id, publicUrl)
    } catch (error) {
      console.error('Erreur upload couverture événement :', error)
    } finally {
      e.target.value = ''
    }
  }

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
        background: event.id?.charCodeAt?.(0) % 2 ? '#fff0f7' : '#f0f4ff',
      }}>
        {hasCover ? (
          <>
            <img src={event.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.45))' }} />
            <div style={{ position: 'absolute', left: 14, right: 74, bottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dateTimeLabel}{event.location ? ` · ${event.location}` : ''}
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              if (isOrganizer) inputRef.current?.click()
            }}
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: '#b85aa0',
              cursor: isOrganizer ? 'pointer' : 'default',
            }}
          >
            {isOrganizer && (
              <span style={{ display: 'grid', placeItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
                <ImageIcon size={22} strokeWidth={1.6} color="#d07ab4" />
                Ajouter une photo de couverture
              </span>
            )}
          </button>
        )}
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          minWidth: 54,
          height: 30,
          borderRadius: hasCover ? 10 : 999,
          background: hasCover ? 'rgba(255,255,255,0.92)' : '#fff',
          color: countdownColor,
          fontSize: 12,
          fontWeight: 900,
          display: 'grid',
          placeItems: 'center',
          padding: '0 10px',
          border: '0.5px solid rgba(0,0,0,0.06)',
        }}>
          {countdown.label}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />
      </div>

      <div style={{ padding: '12px 14px 14px', position: 'relative' }}>
        {!hasCover && (
          <div style={{ paddingRight: 66, marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 500,
              marginTop: 4,
              background: GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {dateTimeLabel}
            </div>
            {event.location && (
              <div style={{
                fontSize: 12,
                fontWeight: 500,
                marginTop: 2,
                background: GRADIENT,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {event.location}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          <div style={{
            background: rsvpChip.bg,
            borderRadius: 999,
            padding: '6px 9px',
            fontSize: 11,
            fontWeight: 800,
            color: rsvpChip.color,
            lineHeight: 1,
          }}>
            {rsvpChip.label}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
            <GuestAvatars profiles={event.memberProfiles ?? []} extraCount={Math.max(0, total - 3)} />
            <div style={{ color: '#6B6B72', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {stats.yes} oui · {stats.maybe} att.
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: '#F2F2F7', overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 999,
              background: GRADIENT,
              minWidth: progress > 0 ? 10 : 0,
            }} />
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
          .select('status, events!inner(id, name, date, user_id, location, type, cover_image, profiles!user_id(full_name))')
          .eq('user_id', user.id),
        supabase
          .from('events')
          .select('id, name, date, user_id, location, type, cover_image, profiles!user_id(full_name)')
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

  function handleCoverUploaded(eventId, coverImage) {
    setInvitedEvents(prev => prev.map(event => event.id === eventId ? { ...event, cover_image: coverImage } : event))
    setOrganizedEvents(prev => prev.map(event => event.id === eventId ? { ...event, cover_image: coverImage } : event))
  }

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
                  <InvitedEventCard key={event.id} event={event} navigate={navigate} onCoverUploaded={handleCoverUploaded} />
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
