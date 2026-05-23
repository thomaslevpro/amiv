import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, User, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AddAmivModal from '../AddAmivModal'
import BirthdayBottomSheet from '../BirthdayBottomSheet'
import BirthdayEditModal from '../BirthdayEditModal'
import HeroBirthdayCard from '../HeroBirthdayCard'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const BUBBLE_THEMES = [
  { fill: '#FFC39A', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: true },
  { fill: '#A9D0F4', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: false },
  { fill: '#B8F5BE', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: true },
  { fill: '#E6CEF5', ringStart: '#E3E0EA', ringEnd: '#E3E0EA', dot: false },
  { fill: '#FFC19B', ringStart: '#E3E0EA', ringEnd: '#E3E0EA', dot: false },
  { fill: '#F4C0D1', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: false },
]
const DAY_HEADERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const DAY_MS = 24 * 60 * 60 * 1000
const RING_RADIUS = 32
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function parseBirthdateParts(birthdate) {
  const [year, month, day] = String(birthdate ?? '').split('-').map(Number)
  return { year, month: month - 1, day }
}

function getNextOccurrence(birthdate, today = startOfToday()) {
  const { month, day } = parseBirthdateParts(birthdate)
  const next = new Date(today.getFullYear(), month, day)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return next
}

function getDaysUntil(birthdate, today = startOfToday()) {
  return Math.round((getNextOccurrence(birthdate, today) - today) / DAY_MS)
}

function getMonthOptions(today) {
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() + index, 1)
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MONTH_LABELS[date.getMonth()],
      month: date.getMonth(),
      year: date.getFullYear(),
    }
  })
}

function getDisplayName(birthday) {
  return [birthday.name, birthday.last_name].filter(Boolean).join(' ').trim() || 'Amiv'
}

function getFirstName(birthday) {
  return birthday.name?.trim() || getDisplayName(birthday).split(' ')[0] || 'Amiv'
}

function formatBirthdateShort(birthdate) {
  const { month, day } = parseBirthdateParts(birthdate)
  if (!day || month < 0 || month >= MONTH_LABELS.length) return ''
  return `${day} ${MONTH_LABELS[month].toLowerCase()}`
}

function enrichBirthdays(rows, today) {
  return rows
    .map((birthday, index) => {
      const nextDate = getNextOccurrence(birthday.birthdate, today)
      const linkedProfile = birthday.linked_profile ?? birthday.profiles ?? null
      return {
        ...birthday,
        linked_profile: linkedProfile,
        avatar_url: linkedProfile?.avatar_url ?? null,
        daysUntil: getDaysUntil(birthday.birthdate, today),
        nextDate,
        theme: BUBBLE_THEMES[index % BUBBLE_THEMES.length],
      }
    })
    .sort((a, b) => a.nextDate - b.nextDate)
}

function BirthdayBubble({ birthday, onClick }) {
  const firstName = getFirstName(birthday)
  const linkedName = birthday.linked_profile?.first_name || birthday.linked_profile?.name || firstName
  const linkedInitials = (linkedName || '?')
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const birthdateLabel = formatBirthdateShort(birthday.birthdate)
  const progress = Math.max(8, Math.round((1 - birthday.daysUntil / 90) * 100))
  const dashOffset = RING_CIRCUMFERENCE * (1 - Math.min(progress, 100) / 100)
  const theme = birthday.theme ?? BUBBLE_THEMES[0]
  const gradientId = `birthday-ring-${birthday.id}`

  return (
    <div
      onClick={onClick}
      style={{
        width: 76,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <div style={{ position: 'relative', width: 74, height: 74, marginBottom: 4 }}>
        <svg width="74" height="74" viewBox="0 0 74 74" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="7" y1="7" x2="67" y2="67" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={theme.ringStart} />
              <stop offset="100%" stopColor={theme.ringEnd} />
            </linearGradient>
          </defs>
          <circle cx="37" cy="37" r={RING_RADIUS} fill="none" stroke="#E7E7ED" strokeWidth="3" />
          <circle
            cx="37"
            cy="37"
            r={RING_RADIUS}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="3"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 37 37)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 7,
            left: 7,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: birthday.linked_profile_id ? 'linear-gradient(135deg,#e055aa,#f5a623)' : theme.fill,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            color: '#fff',
          }}
        >
          {birthday.linked_profile_id && birthday.avatar_url ? (
            <img src={birthday.avatar_url} alt={linkedName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : birthday.linked_profile_id ? (
            <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>{linkedInitials}</span>
          ) : (
            <User size={32} strokeWidth={1.7} />
          )}
        </div>
      </div>
      <div
        style={{
          maxWidth: 76,
          color: '#1C1C1E',
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.2,
          overflow: 'hidden',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {firstName}
      </div>
      {birthdateLabel && (
        <div
          style={{
            maxWidth: 76,
            color: '#8E8E93',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.2,
            marginTop: 2,
            overflow: 'hidden',
            textAlign: 'center',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {birthdateLabel}
        </div>
      )}
    </div>
  )
}

function MonthCalendar({ month, birthdays, today }) {
  const firstDay = new Date(month.year, month.month, 1)
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
  const leadingBlanks = firstDay.getDay()
  const birthdaysInMonth = birthdays.filter(birthday => {
    const { month: birthMonth } = parseBirthdateParts(birthday.birthdate)
    return birthMonth === month.month
  })
  const birthdayDays = new Set(birthdaysInMonth.map(birthday => parseBirthdateParts(birthday.birthdate).day))
  const monthBirthdays = birthdaysInMonth.length
  const cells = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-${index}`, blank: true })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ]

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ color: '#1C1C1E', fontSize: 14, fontWeight: 700 }}>
          {MONTH_NAMES[month.month]} {month.year}
        </div>
        {monthBirthdays > 0 && (
          <div style={{ background: '#FBEAF0', color: '#D4537E', fontSize: 11, fontWeight: 600, borderRadius: 8, padding: '3px 8px' }}>
            {monthBirthdays} anniversaire{monthBirthdays > 1 ? 's' : ''}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 34px)', justifyContent: 'space-between', rowGap: 8 }}>
        {DAY_HEADERS.map((day, index) => (
          <div key={`${day}-${index}`} style={{ width: 34, textAlign: 'center', color: '#AEAEB2', fontSize: 10, fontWeight: 700 }}>
            {day}
          </div>
        ))}
        {cells.map(cell => {
          if (cell.blank) return <div key={cell.key} style={{ width: 34, height: 34 }} />
          const isToday = today.getFullYear() === month.year && today.getMonth() === month.month && today.getDate() === cell.day
          const hasBirthday = birthdayDays.has(cell.day)
          return (
            <div
              key={cell.key}
              style={{
                position: 'relative',
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isToday ? '#D4537E' : 'transparent',
                color: isToday ? '#fff' : '#1C1C1E',
                fontSize: 13,
                fontWeight: isToday ? 700 : 500,
              }}
            >
              {cell.day}
              {hasBirthday && (
                <span style={{ position: 'absolute', bottom: 4, left: '50%', width: 4, height: 4, borderRadius: '50%', background: '#f5a623', transform: 'translateX(-50%)' }} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CalendarSheet({ birthdays, months, today, onClose }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.32)' }} />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 301,
          maxHeight: '86vh',
          background: '#fff',
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -10px 34px rgba(0,0,0,0.16)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '11px 0 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px', flexShrink: 0 }}>
          <div style={{ color: '#1C1C1E', fontSize: 15, fontWeight: 700 }}>Calendrier anniversaires</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 32,
              height: 32,
              border: 'none',
              borderRadius: '50%',
              background: '#F2F2F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3A3A3C',
              cursor: 'pointer',
            }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>
        <div ref={bodyRef} style={{ overflowY: 'auto', padding: '2px 18px 28px', WebkitOverflowScrolling: 'touch' }}>
          {months.map(month => (
            <MonthCalendar key={month.key} month={month} birthdays={birthdays} today={today} />
          ))}
        </div>
      </div>
    </>
  )
}

export default function BirthdaySection({ user, onToast, onMessage }) {
  const [birthdays, setBirthdays] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAddAmiv, setShowAddAmiv] = useState(false)
  const [selectedBirthday, setSelectedBirthday] = useState(null)
  const [editBirthday, setEditBirthday] = useState(null)
  const today = useMemo(() => startOfToday(), [])
  const months = useMemo(() => getMonthOptions(today), [today])

  async function fetchBirthdays() {
    if (!user?.id) {
      setBirthdays([])
      setLoading(false)
      return
    }

    setLoading(true)
    let { data, error } = await supabase
      .from('birthdays')
      .select('id, name, last_name, birthdate, linked_profile_id, reminder_enabled, reminder_days, linked_profile:profiles(id, first_name, name, avatar_url)')
      .eq('user_id', user.id)
      .order('birthdate', { ascending: true })

    if (error) {
      console.error('Chargement des anniversaires avec profil lié impossible :', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      })
      const fallback = await supabase
        .from('birthdays')
        .select('id, name, last_name, birthdate, linked_profile_id, reminder_enabled, reminder_days')
        .eq('user_id', user.id)
        .order('birthdate', { ascending: true })

      if (fallback.error) {
        console.error('Erreur lors du chargement des anniversaires :', fallback.error)
        onToast?.('Erreur lors du chargement des anniversaires', true)
        setLoading(false)
        return
      } else {
        data = fallback.data ?? []
        const linkedIds = [...new Set(data.map(item => item.linked_profile_id).filter(Boolean))]
        if (linkedIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, name, avatar_url')
            .in('id', linkedIds)

          if (profileError) {
            console.error('Erreur lors du chargement des profils liés :', profileError)
          } else {
            const profilesById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
            data = data.map(item => ({ ...item, linked_profile: profilesById[item.linked_profile_id] ?? null }))
          }
        }
      }
    }

    const enriched = enrichBirthdays(data ?? [], today)
    setBirthdays(enriched)
    setSelectedBirthday(current => current ? enriched.find(item => item.id === current.id) ?? current : current)
    setLoading(false)
  }

  function handleLinkedProfileChanged(birthdayId, profile) {
    const linkedProfileId = profile?.id ?? null

    setBirthdays(current => current.map(item =>
      item.id === birthdayId
        ? {
            ...item,
            linked_profile_id: linkedProfileId,
            linked_profile: profile,
            avatar_url: profile?.avatar_url ?? null,
          }
        : item
    ))
    setSelectedBirthday(current =>
      current?.id === birthdayId
        ? {
            ...current,
            linked_profile_id: linkedProfileId,
            linked_profile: profile,
            avatar_url: profile?.avatar_url ?? null,
          }
        : current
    )
    fetchBirthdays()
  }

  useEffect(() => {
    fetchBirthdays()
  }, [user?.id])

  const filteredBirthdays = useMemo(() => {
    if (activeFilter === 'all') return birthdays
    const month = months.find(item => item.key === activeFilter)
    if (!month) return birthdays
    return birthdays
      .filter(birthday => parseBirthdateParts(birthday.birthdate).month === month.month)
      .sort((a, b) => parseBirthdateParts(a.birthdate).day - parseBirthdateParts(b.birthdate).day)
  }, [activeFilter, birthdays, months])

  const heroBirthday = birthdays[0]
    ? { ...birthdays[0], days: birthdays[0].daysUntil }
    : null

  return (
    <>
      {!loading && <HeroBirthdayCard birthday={heroBirthday} onMessage={onMessage} />}

      <section style={{ background: '#faf9fb', padding: '2px 0 18px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>
        <style>{`
          [data-birthday-scroll]::-webkit-scrollbar { display: none; }
        `}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 2px' }}>
          <div style={{ color: '#8E8E93', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Anniversaires
          </div>
          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            aria-label="Ouvrir le calendrier anniversaires"
            style={{
              width: 34,
              height: 34,
              border: 'none',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 5px rgba(0,0,0,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e055aa',
              cursor: 'pointer',
            }}
          >
            <CalendarDays size={18} strokeWidth={1.9} />
          </button>
        </div>

      <div
        data-birthday-scroll
        style={{
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: '2px 2px 13px',
        }}
      >
        {[{ key: 'all', label: 'Tous' }, ...months].map(option => {
          const isActive = activeFilter === option.key
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveFilter(option.key)}
              style={{
                flexShrink: 0,
                padding: '6px 15px',
                border: 'none',
                borderRadius: 18,
                background: isActive ? 'linear-gradient(135deg, #e055aa, #f5a623)' : '#fff',
                boxShadow: isActive ? '0 3px 9px rgba(224,85,170,0.22)' : '0 1px 3px rgba(0,0,0,0.07)',
                color: isActive ? '#fff' : '#8E8E93',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 12, padding: '4px 2px 6px' }}>
          {[0, 1, 2, 3].map(item => (
            <div key={item} style={{ width: 76, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 66, height: 66, borderRadius: '50%', background: '#E5E5EA' }} />
              <div style={{ width: 46, height: 9, borderRadius: 5, background: '#E5E5EA' }} />
            </div>
          ))}
        </div>
      ) : birthdays.length === 0 ? (
        <div style={{ padding: '12px 2px 4px', color: '#AEAEB2', fontSize: 13, lineHeight: 1.45 }}>
          <div>Pas encore d'anniversaires.</div>
          <button
            type="button"
            onClick={() => setShowAddAmiv(true)}
            style={{ marginTop: 8, padding: 0, border: 'none', background: 'transparent', color: '#e055aa', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Ajouter un anniversaire
          </button>
        </div>
      ) : filteredBirthdays.length === 0 ? (
        <div style={{ color: '#AEAEB2', fontSize: 13, padding: '15px 2px 10px' }}>
          Aucun anniversaire ce mois
        </div>
      ) : (
        <div
          data-birthday-scroll
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            padding: '4px 0 7px',
          }}
        >
          {filteredBirthdays.map(birthday => (
            <BirthdayBubble key={birthday.id} birthday={birthday} onClick={() => setSelectedBirthday(birthday)} />
          ))}
        </div>
      )}

      {showCalendar && (
        <CalendarSheet birthdays={birthdays} months={months} today={today} onClose={() => setShowCalendar(false)} />
      )}

      {showAddAmiv && (
        <AddAmivModal
          onClose={() => setShowAddAmiv(false)}
          onSaved={fetchBirthdays}
          onToast={onToast}
        />
      )}

      {selectedBirthday && (
        <BirthdayBottomSheet
          birthday={selectedBirthday}
          onClose={() => setSelectedBirthday(null)}
          onEdit={() => setEditBirthday(selectedBirthday)}
          onDeleted={() => {
            setSelectedBirthday(null)
            fetchBirthdays()
          }}
          onLinkedProfileChanged={handleLinkedProfileChanged}
          userId={user?.id}
          onToast={onToast}
        />
      )}

      {editBirthday && (
        <BirthdayEditModal
          birthday={editBirthday}
          onClose={() => setEditBirthday(null)}
          onSaved={() => {
            setEditBirthday(null)
            fetchBirthdays()
          }}
          onToast={onToast}
        />
      )}
      </section>
    </>
  )
}
