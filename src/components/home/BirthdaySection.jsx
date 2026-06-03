import { useEffect, useMemo, useState } from 'react'
import { Link2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AddAmivModal from '../AddAmivModal'
import BirthdayBottomSheet from '../BirthdayBottomSheet'
import BirthdayEditModal from '../BirthdayEditModal'
import HeroBirthdayCard from '../HeroBirthdayCard'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const BUBBLE_THEMES = [
  { fill: '#FFD6E7', letter: '#C4185A', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: true  },
  { fill: '#FFE9B0', letter: '#A86000', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: true  },
  { fill: '#D6F0FF', letter: '#1A6FA8', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: false },
  { fill: '#E8D6FF', letter: '#6B2DB5', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: true  },
  { fill: '#C8F5D6', letter: '#1A7A42', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: false },
  { fill: '#FFD0B8', letter: '#C44A1A', ringStart: '#E7549B', ringEnd: '#F6A04A', dot: true  },
];
const DAY_HEADERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const DAY_MS = 24 * 60 * 60 * 1000
const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const HERO_CARD_THEMES = {
  availability: {
    border: 'linear-gradient(135deg, #0A84FF, #64D2FF, #0A84FF)',
    background: 'radial-gradient(circle at 86% 12%, rgba(122, 205, 255, 0.64) 0%, rgba(10, 132, 255, 0.28) 28%, rgba(10, 132, 255, 0) 48%), linear-gradient(135deg, #007AFF 0%, #0A84FF 58%, #64D2FF 100%)',
    shadow: '0 4px 24px rgba(0,122,255,0.26)',
  },
  event: {
    border: 'linear-gradient(135deg, #30D158, #34C759, #00C7BE)',
    background: 'radial-gradient(circle at 86% 12%, rgba(128, 255, 194, 0.56) 0%, rgba(52, 199, 89, 0.25) 28%, rgba(52, 199, 89, 0) 48%), linear-gradient(135deg, #28B463 0%, #34C759 58%, #00C7BE 100%)',
    shadow: '0 4px 24px rgba(52,199,89,0.25)',
  },
}

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

function getBirthdayLinkedProfile(birthday) {
  return birthday?.linked_profile ?? birthday?.profiles ?? null
}

function getBirthdayDisplayName(birthday) {
  const linkedProfile = getBirthdayLinkedProfile(birthday)
  if (birthday?.linked_profile_id && linkedProfile) {
    return linkedProfile.first_name || linkedProfile.name || getFirstName(birthday)
  }
  return getFirstName(birthday)
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatBirthdateShort(birthdate) {
  const { month, day } = parseBirthdateParts(birthdate)
  if (!day || month < 0 || month >= MONTH_LABELS.length) return ''
  return `${day} ${MONTH_LABELS[month].toLowerCase()}`
}

function getProfileName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ') || 'Ami'
}

function formatEventDate(dateStr) {
  if (!dateStr) return 'Date à définir'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Date à définir'
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
}

function HomeHeroInfoCard({ eyebrow, title, subtitle, theme, onClick, truncateTitle = false }) {
  return (
    <div style={{
      padding: '2.5px',
      borderRadius: 22,
      background: theme.border,
      marginBottom: 0,
      flex: '1 1 0',
      minWidth: 0,
      display: 'flex',
    }}>
      <div
        onClick={onClick}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: theme.background,
          borderRadius: 19,
          padding: '14px',
          boxShadow: theme.shadow,
          color: '#fff',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', whiteSpace: 'normal', lineHeight: 1.15, marginBottom: 4 }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.15, whiteSpace: truncateTitle ? 'nowrap' : 'normal', overflow: truncateTitle ? 'hidden' : 'visible', textOverflow: truncateTitle ? 'ellipsis' : 'clip', width: '100%' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.2, whiteSpace: 'normal', minWidth: 0, maxWidth: '100%', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
    </div>
  )
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
  const isLinked = Boolean(birthday.linked_profile_id)
  const displayName = getBirthdayDisplayName(birthday)
  const linkedInitials = getInitials(displayName)
  const birthdateLabel = formatBirthdateShort(birthday.birthdate)
  const progress = Math.max(8, Math.round((1 - birthday.daysUntil / 90) * 100))
  const dashOffset = RING_CIRCUMFERENCE * (1 - Math.min(progress, 100) / 100)
  const theme = birthday.theme ?? BUBBLE_THEMES[0]
  const gradientId = `birthday-ring-${birthday.id}`

  return (
    <div
      onClick={onClick}
      style={{
        width: 60,
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
      <div style={{ position: 'relative', width: 60, height: 60, marginBottom: 4 }}>
        <svg width="60" height="60" viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="5" y1="5" x2="55" y2="55" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={theme.ringStart} />
              <stop offset="100%" stopColor={theme.ringEnd} />
            </linearGradient>
          </defs>
          <circle cx="30" cy="30" r={RING_RADIUS} fill="none" stroke="#E7E7ED" strokeWidth="3" />
          <circle
            cx="30"
            cy="30"
            r={RING_RADIUS}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="3"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 30 30)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: isLinked ? 'linear-gradient(135deg,#e055aa,#f5a623)' : theme.fill,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            color: '#fff',
          }}
        >
          {isLinked && birthday.avatar_url ? (
            <img src={birthday.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : isLinked ? (
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{linkedInitials}</span>
          ) : (
            <span style={{ fontSize: 17, fontWeight: 800, color: theme.letter }}>{displayName[0]?.toUpperCase() ?? '?'}</span>
          )}
        </div>
        {isLinked && (
          <div
            aria-label="Profil lié"
            title="Profil lié"
            style={{
              position: 'absolute',
              right: 3,
              bottom: 5,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#e055aa,#f5a623)',
              border: '1.5px solid #fff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 1px 4px rgba(18,31,46,0.18)',
            }}
          >
            <Link2 size={8.5} color="#fff" strokeWidth={2.4} />
          </div>
        )}
      </div>
      <div
        style={{
          maxWidth: 60,
          color: '#1C1C1E',
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.2,
          overflow: 'hidden',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayName}
      </div>
      {birthdateLabel && (
        <div
          style={{
            maxWidth: 60,
            color: '#8E8E93',
            fontSize: 11,
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


export default function BirthdaySection({
  user,
  onToast,
  onMessage,
  refreshTrigger = 0,
  availabilityFeed = [],
  availableFriendsCount = 0,
  nextEvent = null,
  onAvailabilityClick,
  onEventClick,
}) {
  const [birthdays, setBirthdays] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
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

  function handleHeroReminderSaved(updatedBirthday) {
    setBirthdays(current => current.map(item =>
      item.id === updatedBirthday.id
        ? {
            ...item,
            reminder_enabled: updatedBirthday.reminder_enabled,
            reminder_days: updatedBirthday.reminder_days,
          }
        : item
    ))
    setSelectedBirthday(current =>
      current?.id === updatedBirthday.id
        ? {
            ...current,
            reminder_enabled: updatedBirthday.reminder_enabled,
            reminder_days: updatedBirthday.reminder_days,
          }
        : current
    )
  }

  useEffect(() => {
    fetchBirthdays()
  }, [user?.id, refreshTrigger])

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
  const availableFriendNames = availabilityFeed
    .filter(post => post.user_id !== user?.id)
    .map(post => getProfileName(post.profiles))
    .filter((name, index, names) => names.indexOf(name) === index)
  const availabilityTitle = availableFriendsCount > 0
    ? `${availableFriendsCount} ami${availableFriendsCount > 1 ? 's' : ''} dispo`
    : 'Aucun ami dispo'
  const availabilitySubtitle = availableFriendNames.length > 0
    ? availableFriendNames.slice(0, 3).join(', ')
    : 'Cette semaine'

  return (
    <>
      {!loading && (
        <div style={{ marginBottom: 0 }}>
          <HeroBirthdayCard
            birthday={heroBirthday}
            onReminderSaved={handleHeroReminderSaved}
            onToast={onToast}
          />
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <HomeHeroInfoCard
              eyebrow="Amis disponibles"
              title={availabilityTitle}
              subtitle={availabilitySubtitle}
              theme={HERO_CARD_THEMES.availability}
              onClick={onAvailabilityClick}
            />
            <HomeHeroInfoCard
              eyebrow="Prochain événement"
              title={nextEvent?.name || 'Aucun événement'}
              subtitle={nextEvent ? formatEventDate(nextEvent.date) : 'Crée ton prochain Amiv'}
              theme={HERO_CARD_THEMES.event}
              onClick={nextEvent ? () => onEventClick?.(nextEvent) : undefined}
              truncateTitle
            />
          </div>
        </div>
      )}

      <section style={{ background: '#faf9fb', padding: '2px 0 18px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>
        <style>{`
          [data-birthday-scroll]::-webkit-scrollbar { display: none; }
        `}</style>
        <div style={{ marginBottom: 12, padding: '0 2px' }}>
          <div style={{ color: '#8E8E93', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Anniversaires
          </div>
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
            gap: 8,
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
