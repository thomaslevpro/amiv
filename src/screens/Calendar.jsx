import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Share2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const DAY_LABELS = ['LUN', 'MA.', 'ME.', 'JEU', 'VEN', 'SA.', 'DIM']
const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'
const PAGE_BG = '#F2F2F7'

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'organizer', label: "J'organise" },
  { key: 'going', label: "J'y participe" },
  { key: 'pending', label: 'En attente' },
]

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

function getCountdown(dateStr) {
  if (!dateStr) return { label: 'J-?', days: null, past: false }
  const eventDate = new Date(dateStr)
  if (Number.isNaN(eventDate.getTime())) return { label: 'J-?', days: null, past: false }
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startEvent = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
  const days = Math.ceil((startEvent - startToday) / 86400000)
  if (days < 0) return { label: 'Passé', days, past: true }
  if (days === 0) return { label: 'Jour J', days, past: false }
  return { label: `J-${days}`, days, past: false }
}

function isInviteOnly(visibility) {
  return ['Sur invitation', 'invite_only', 'private'].includes(visibility)
}

function getInitial(profile, fallback = 'A') {
  return (profile?.first_name || profile?.name || profile?.email || fallback || 'A').charAt(0).toUpperCase()
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

function ProfileAvatar({ profile }) {
  return (
    <div style={{
      width: 42,
      height: 42,
      borderRadius: 18,
      overflow: 'hidden',
      background: 'linear-gradient(135deg,#fff,#FFE7F4)',
      boxShadow: '0 10px 26px rgba(224,85,170,0.18)',
      border: '1px solid rgba(255,255,255,0.78)',
      display: 'grid',
      placeItems: 'center',
      color: '#1C1C1E',
      fontSize: 15,
      fontWeight: 900,
      flexShrink: 0,
    }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : getInitial(profile)}
    </div>
  )
}

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: 38,
        padding: '0 15px',
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: active ? GRADIENT : '#fff',
        color: active ? '#fff' : '#6B6B72',
        border: active ? '0.5px solid transparent' : '0.5px solid rgba(0,0,0,0.08)',
        boxShadow: active ? '0 8px 18px rgba(224,85,170,0.22)' : '0 2px 8px rgba(0,0,0,0.03)',
        fontSize: 13,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {label} ({count})
    </button>
  )
}

function Pill({ children, tone = 'gray' }) {
  const tones = {
    blue: { bg: 'rgba(0,122,255,0.12)', color: '#007AFF' },
    green: { bg: 'rgba(52,199,89,0.13)', color: '#178C3B' },
    orange: { bg: 'rgba(245,166,35,0.16)', color: '#A35E00' },
    gray: { bg: '#F2F2F7', color: '#6B6B72' },
    lock: { bg: 'rgba(142,142,147,0.14)', color: '#5F5F66' },
  }
  const style = tones[tone] || tones.gray
  return (
    <span style={{
      minHeight: 26,
      padding: '6px 9px',
      borderRadius: 999,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: style.bg,
      color: style.color,
      fontSize: 11,
      fontWeight: 800,
      lineHeight: 1,
      maxWidth: '100%',
    }}>
      {children}
    </span>
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
          }}
        >
          {getInitial(profile, 'I')}
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

function RsvpButton({ children, primary, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 36,
        borderRadius: 13,
        background: primary ? GRADIENT : '#F2F2F7',
        color: primary ? '#fff' : '#4B4B52',
        fontSize: 12,
        fontWeight: 850,
        display: 'grid',
        placeItems: 'center',
        padding: '0 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function ActionButton({ icon: Icon, label, onClick, border }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        color: '#5F5F66',
        fontSize: 12,
        fontWeight: 800,
        borderLeft: border ? '0.5px solid rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <Icon size={14} strokeWidth={2.2} />
      {label}
    </button>
  )
}

function EventCard({ item, onOpen, onManage, onChat, onShare, onCalendar, onRsvp }) {
  const { event, isOrganizer, myStatus, stats, memberProfiles } = item
  const isPast = item.isPast
  const countdown = getCountdown(event.date)
  const countdownColor = countdown.past
    ? '#8E8E93'
    : countdown.days < 14
      ? '#e055aa'
      : countdown.days < 60
        ? '#f5a623'
        : '#8E8E93'
  const total = stats.yes + stats.no + stats.maybe
  const progress = total > 0 ? Math.round((stats.yes / total) * 100) : 0
  const canRsvpInline = !isOrganizer && myStatus !== 'yes'

  const statusPill = isOrganizer
    ? <Pill tone="blue">👑 J'organise</Pill>
    : myStatus === 'yes'
      ? <Pill tone="green">✓ J'y serai</Pill>
      : myStatus === 'maybe'
        ? <Pill tone="orange">Peut-être</Pill>
        : <Pill tone="gray">En attente</Pill>

  return (
    <article style={{
      borderRadius: 18,
      background: '#fff',
      border: '0.5px solid rgba(0,0,0,0.08)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <button
        onClick={() => onOpen(event)}
        style={{
          width: '100%',
          height: 80,
          padding: '0 14px',
          background: isPast
            ? 'linear-gradient(135deg, #F3F3F6, #ECECF1)'
            : 'linear-gradient(135deg, rgba(224,85,170,0.08), rgba(245,166,35,0.08))',
          display: 'grid',
          gridTemplateColumns: '52px 1fr auto',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
        }}
      >
        <span style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: isPast ? '#fff' : 'linear-gradient(135deg, rgba(224,85,170,0.13), rgba(245,166,35,0.15))',
          display: 'grid',
          placeItems: 'center',
          fontSize: 28,
          boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.05)',
        }}>
          {event.emoji || '🎉'}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: '#1C1C1E',
            fontSize: 15,
            fontWeight: 850,
            lineHeight: 1.16,
            marginBottom: 5,
          }}>
            {titleCase(event.name, 'Amiv')}
          </span>
          <span style={{
            color: isPast ? '#8E8E93' : '#C23F91',
            fontSize: 12,
            fontWeight: 760,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}>
            {formatEventDate(event.date)}
          </span>
        </span>
        <span style={{
          minWidth: 54,
          height: 30,
          borderRadius: 999,
          background: '#fff',
          color: countdownColor,
          fontSize: 12,
          fontWeight: 900,
          display: 'grid',
          placeItems: 'center',
          padding: '0 10px',
          border: '0.5px solid rgba(0,0,0,0.06)',
        }}>
          {countdown.label}
        </span>
      </button>

      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: isOrganizer || canRsvpInline ? 12 : 0 }}>
          {statusPill}
          {event.location && <Pill tone="gray">📍 {event.location}</Pill>}
          {event.type && <Pill tone="gray">{titleCase(event.type, 'Événement')}</Pill>}
          {isInviteOnly(event.visibility) && <Pill tone="lock">🔒 Secret</Pill>}
        </div>

        {isOrganizer && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
              <GuestAvatars profiles={memberProfiles} extraCount={Math.max(0, total - 3)} />
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
        )}

        {canRsvpInline && (
          <div style={{ display: 'flex', gap: 7 }}>
            <RsvpButton primary onClick={() => onRsvp(item, 'yes')}>✓ J'y serai</RsvpButton>
            <RsvpButton onClick={() => onRsvp(item, 'maybe')}>Peut-être</RsvpButton>
            <RsvpButton onClick={() => onRsvp(item, 'no')}>✕ Pas là</RsvpButton>
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', transform: 'scaleY(0.5)' }} />
      <div style={{ display: 'flex', height: 44 }}>
        {isOrganizer ? (
          <>
            <ActionButton icon={Settings} label="Gérer" onClick={() => onManage(event)} />
            <ActionButton icon={MessageCircle} label="Chat" border onClick={() => onChat(event)} />
            <ActionButton icon={Share2} label="Partager" border onClick={() => onShare(event)} />
          </>
        ) : (
          <>
            <ActionButton icon={Eye} label="Voir" onClick={() => onOpen(event)} />
            <ActionButton icon={MessageCircle} label="Chat" border onClick={() => onChat(event)} />
            <ActionButton icon={CalendarDays} label="Agenda" border onClick={() => onCalendar(event)} />
          </>
        )}
      </div>
    </article>
  )
}

export default function Calendar({ onEventClick, onCreateClick, onMessagesClick }) {
  const navigate = useNavigate()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarDots, setCalendarDots] = useState([])
  const [profile, setProfile] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [organizedEvents, setOrganizedEvents] = useState([])
  const [guestEvents, setGuestEvents] = useState([])
  const [rsvpsByEvent, setRsvpsByEvent] = useState({})
  const [publicRsvpsByEvent, setPublicRsvpsByEvent] = useState({})
  const [profilesById, setProfilesById] = useState({})
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')

  const fetchCalendarDots = useCallback(async () => {
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const monthStart = toYMD(new Date(year, month, 1))
      const monthEnd = toYMD(new Date(year, month + 1, 0))
      const { data } = await supabase.rpc('get_calendar_dots', { month_start: monthStart, month_end: monthEnd })
      setCalendarDots(data || [])
    } catch (err) {
      console.error('Calendar dots error:', err)
    }
  }, [currentMonth])

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCurrentUser(null)
      setLoadingEvents(false)
      return
    }

    const eventSelect = 'id, name, emoji, date, location, type, visibility, user_id, invite_token'
    const [profileRes, organizedRes, guestRes] = await Promise.all([
      supabase.from('profiles').select('id, name, first_name, avatar_url, email').eq('id', user.id).maybeSingle(),
      supabase.from('events').select(eventSelect).eq('user_id', user.id).order('date', { ascending: true }),
      supabase
        .from('invitations')
        .select(`status, events(${eventSelect})`)
        .eq('invited_user_id', user.id)
        .neq('status', 'declined'),
    ])

    const organized = organizedRes.data ?? []
    const guests = (guestRes.data ?? []).filter(item => item.events)
    const allEvents = [...organized, ...guests.map(item => item.events)]
    const eventIds = [...new Set(allEvents.map(event => event.id).filter(Boolean))]

    let memberRows = []
    let publicRows = []
    if (eventIds.length > 0) {
      const [rsvpRes, publicRes] = await Promise.all([
        supabase.from('rsvps').select('event_id, user_id, status').in('event_id', eventIds),
        supabase.from('public_rsvps').select('event_id, status').in('event_id', eventIds),
      ])

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
    setProfile(profileRes.data ?? { id: user.id, email: user.email })
    setOrganizedEvents(organized)
    setGuestEvents(guests.sort((a, b) => new Date(a.events.date || '9999-12-31') - new Date(b.events.date || '9999-12-31')))
    setRsvpsByEvent(groupByEvent(memberRows))
    setPublicRsvpsByEvent(groupByEvent(publicRows))
    setProfilesById(profileMap)
    setLoadingEvents(false)
  }, [])

  useEffect(() => { fetchCalendarDots() }, [fetchCalendarDots])
  useEffect(() => { fetchEvents() }, [fetchEvents])

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

  const counts = useMemo(() => ({
    all: items.length,
    organizer: items.filter(item => item.filter === 'organizer').length,
    going: items.filter(item => item.filter === 'going').length,
    pending: items.filter(item => item.filter === 'pending').length,
  }), [items])

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter(item => {
      const matchesFilter = activeFilter === 'all' || item.filter === activeFilter
      const matchesSearch = !query || `${item.title} ${item.location} ${item.type}`.toLowerCase().includes(query)
      const matchesDate = !selectedDate || safeYMD(item.event.date) === selectedDate
      return matchesFilter && matchesSearch && matchesDate
    })
  }, [items, activeFilter, search, selectedDate])

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

  function addToCalendar(event) {
    if (!event.date) return
    const date = new Date(event.date)
    if (Number.isNaN(date.getTime())) return
    const end = new Date(date.getTime() + 2 * 60 * 60 * 1000)
    const format = value => value.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name || 'Amiv')}&dates=${format(date)}/${format(end)}&location=${encodeURIComponent(event.location || '')}`
    window.open(url, '_blank', 'noopener,noreferrer')
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
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function handleNextMonth() {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function renderSection(label, sectionItems) {
    return (
      <section style={{ marginBottom: 18 }}>
        <div style={{
          color: '#8E8E93',
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: '4px 2px 10px',
        }}>
          {label}
        </div>
        {sectionItems.length === 0 ? (
          <SectionPlaceholder label={label} />
        ) : (
          sectionItems.map(item => (
            <EventCard
              key={item.id}
              item={item}
              onOpen={openEvent}
              onManage={manageEvent}
              onChat={openChat}
              onShare={shareEvent}
              onCalendar={addToCalendar}
              onRsvp={handleRsvp}
            />
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
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontSize: 38,
                fontWeight: 900,
                lineHeight: 0.95,
                background: GRADIENT,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Amiv
              </h1>
              <div style={{ marginTop: 5, color: '#8E8E93', fontSize: 15, fontWeight: 700 }}>
                Amivs & anniversaires
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <ProfileAvatar profile={profile} />
              <IconButton label="Rechercher" onClick={() => setSearchOpen(v => !v)} style={{ marginTop: 2 }}>
                {searchOpen ? <X size={18} /> : <Search size={18} />}
              </IconButton>
              <IconButton label="Choisir une date" onClick={() => setIsCalendarOpen(true)} style={{ marginTop: 2 }}>
                <CalendarDays size={18} />
              </IconButton>
            </div>
          </div>

          <button
            onClick={() => onCreateClick?.()}
            style={{
              width: '100%',
              minHeight: 72,
              borderRadius: 18,
              background: GRADIENT,
              color: '#fff',
              padding: '13px 14px',
              display: 'grid',
              gridTemplateColumns: '38px 1fr 22px',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 12px 26px rgba(224,85,170,0.22)',
              textAlign: 'left',
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

          <div style={{
            overflow: 'hidden',
            maxHeight: searchOpen ? 54 : 0,
            opacity: searchOpen ? 1 : 0,
            transition: 'max-height 0.22s ease, opacity 0.18s ease',
          }}>
            <div style={{
              marginTop: 10,
              height: 44,
              borderRadius: 18,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 13px',
              border: '0.5px solid rgba(0,0,0,0.08)',
            }}>
              <Search size={17} color="#8E8E93" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher un événement"
                style={{ flex: 1, background: 'transparent', fontSize: 14, fontWeight: 650, color: '#1C1C1E' }}
              />
            </div>
          </div>
        </header>

        <div style={{
          position: 'sticky',
          top: -1,
          zIndex: 20,
          margin: '0 -14px',
          padding: '9px 14px 12px',
          background: 'rgba(242,242,247,0.86)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0' }}>
            {FILTERS.map(filter => (
              <FilterChip
                key={filter.key}
                label={filter.label}
                count={counts[filter.key]}
                active={activeFilter === filter.key}
                onClick={() => setActiveFilter(filter.key)}
              />
            ))}
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              style={{
                marginTop: 8,
                height: 30,
                padding: '0 11px',
                borderRadius: 999,
                background: 'rgba(224,85,170,0.1)',
                color: '#B8337F',
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              {formatEventDate(selectedDate)} · effacer
            </button>
          )}
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

        <main style={{ paddingTop: 8 }}>
          {loadingEvents ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  height: 180,
                  borderRadius: 18,
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.56), rgba(255,255,255,0.92), rgba(255,255,255,0.56))',
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
