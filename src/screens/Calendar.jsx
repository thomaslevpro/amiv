import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function buildGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const grid = []
  for (let i = 0; i < offset; i++) grid.push(null)
  for (let i = 1; i <= daysInMonth; i++) grid.push(i)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

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

export default function Calendar() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarDots, setCalendarDots] = useState([])
  const [invitedEvents, setInvitedEvents] = useState([])
  const [myEvent, setMyEvent] = useState(null)
  const [myEventStats, setMyEventStats] = useState({ done: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const monthStart = toYMD(new Date(year, month, 1))
      const monthEnd = toYMD(new Date(year, month + 1, 0))
      const in90days = toYMD(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))

      const [dotsRes, invitedRes, myEventRes] = await Promise.all([
        supabase.rpc('get_calendar_dots', { month_start: monthStart, month_end: monthEnd }),
        supabase
          .from('events')
          .select('id, name, date, user_id, profiles!user_id(full_name), rsvps!inner(status, user_id)')
          .neq('user_id', user.id)
          .gte('date', toYMD(new Date()))
          .lte('date', in90days),
        supabase
          .from('events')
          .select('id, name, date, user_id')
          .eq('user_id', user.id)
          .eq('type', 'birthday')
          .maybeSingle()
      ])

      setCalendarDots(dotsRes.data || [])

      // Filtre côté client : seulement les events où l'user est dans les rsvps
      const filtered = (invitedRes.data || []).filter(ev =>
        ev.rsvps?.some(r => r.user_id === user.id)
      )
      setInvitedEvents(filtered)

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

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const grid = buildGrid(year, month)
  const todayStr = toYMD(new Date())

  const dotMap = {}
  calendarDots.forEach(({ event_date, dot_type }) => {
    if (!dotMap[event_date]) dotMap[event_date] = []
    if (!dotMap[event_date].includes(dot_type)) dotMap[event_date].push(dot_type)
  })

  const monthLabel = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, padding: '6px 2px 0' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>Calendrier</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>Amivs &amp; anniversaires</div>
          </div>
        </div>

        {/* Calendar widget */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 14, marginBottom: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              style={{ width: 28, height: 28, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={14} strokeWidth={1.5} color="#8E8E93" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', textTransform: 'capitalize' }}>{monthLabel}</div>
            <div
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              style={{ width: 28, height: 28, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={14} strokeWidth={1.5} color="#8E8E93" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DAYS.map((d, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 600, color: '#AEAEB2', textAlign: 'center', padding: '4px 0' }}>{d}</div>
            ))}
            {grid.map((d, i) => {
              if (!d) return <div key={i} />
              const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const isToday = dayStr === todayStr
              const dots = dotMap[dayStr] || []
              return (
                <div key={i} style={{
                  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: isToday ? 700 : 400, borderRadius: '50%',
                  color: isToday ? '#fff' : '#1C1C1E',
                  background: isToday ? 'linear-gradient(135deg,#e055aa,#f5a623)' : 'transparent',
                  margin: 'auto', position: 'relative',
                }}>
                  {d}
                  {dots.length > 0 && !isToday && (
                    <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                      {dots.includes('invited') && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#e055aa' }} />}
                      {dots.includes('own') && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#007AFF' }} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Section : Invité à ces amivs */}
        {!loading && invitedEvents.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 2px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#8E8E93' }}>
                Invité à ces amivs
              </span>
            </div>
            {invitedEvents.map(event => {
              const p = prenom(event.profiles?.full_name)
              const j = daysLeft(event.date)
              const rsvpStatus = event.rsvps?.find(r => r.user_id)?.status
              return (
                <div key={event.id}
                  onClick={() => navigate(`/events/${event.id}/secret-space`)}
                  style={{ background: 'white', borderRadius: 16, marginBottom: 10, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px 11px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 13, fontSize: 18, background: 'rgba(224,85,170,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🎂</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Amiv de {p}</div>
                      <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 2 }}>{formatDate(event.date)} · J-{j} · organisé par {p}</div>
                    </div>
                    <div style={{ width: 26, height: 26, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#AEAEB2' }}>›</div>
                  </div>
                  <div style={{ padding: '0 13px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(224,85,170,0.09)', color: '#72243E' }}>🔒 Espace secret</span>
                    <span style={{ padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: rsvpStatus === 'accepted' ? 'rgba(52,199,89,0.09)' : '#F2F2F7', color: rsvpStatus === 'accepted' ? '#1d7a38' : '#6B6B6B' }}>
                      {rsvpStatus === 'accepted' ? '✓ J\'y serai' : 'En attente'}
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Divider Mon amiv */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px' }}>
          <div style={{ flex: 1, height: 0.5, background: '#AEAEB2', opacity: 0.35 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '.06em', textTransform: 'uppercase' }}>Mon amiv</span>
          <div style={{ flex: 1, height: 0.5, background: '#AEAEB2', opacity: 0.35 }} />
        </div>

        {/* Section : Mon amiv */}
        {!loading && (
          myEvent ? (
            <div onClick={() => navigate(`/events/${myEvent.id}/organizer-space`)}
              style={{ background: 'white', borderRadius: 16, marginBottom: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', cursor: 'pointer', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px 11px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, fontSize: 18, background: 'rgba(0,122,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🥳</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Mon anniversaire</div>
                  <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 2 }}>{formatDate(myEvent.date)} · J-{daysLeft(myEvent.date)}</div>
                </div>
                <div style={{ width: 26, height: 26, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#AEAEB2' }}>›</div>
              </div>
              <div style={{ padding: '0 13px 12px' }}>
                <div style={{ height: 5, background: '#F2F2F7', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#e055aa,#f5a623)', width: myEventStats.total > 0 ? `${Math.round(myEventStats.done / myEventStats.total * 100)}%` : '0%' }} />
                </div>
                <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 4 }}>Checklist · {myEventStats.done} / {myEventStats.total} tâches</div>
              </div>
            </div>
          ) : (
            <div onClick={() => navigate('/events/create', { state: { defaultType: 'birthday' } })}
              style={{ background: 'white', border: '1.5px dashed #AEAEB2', borderRadius: 16, padding: 20, textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}>
              <div style={{ fontSize: 22, color: '#AEAEB2', marginBottom: 6 }}>+</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Crée ton amiv</div>
              <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4 }}>Organise ton propre anniversaire</div>
            </div>
          )
        )}

      </div>
    </div>
  )
}
