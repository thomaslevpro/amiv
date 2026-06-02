import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Coffee,
  Edit,
  Footprints,
  Gamepad2,
  Plus,
  Sparkles,
  Trash,
  Utensils,
  Wine,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const AVATAR_BACKGROUNDS = ['#FBBF9A', '#B5D4F4', '#C0DD97', '#F4C0D1', '#CEB5F4', '#FAC775']
const AVATAR_TEXT = ['#c07040', '#185FA5', '#3B6D11', '#993556', '#5A3AB7', '#8B5E00']

const moodIcons = {
  cafe: Coffee,
  jeux: Gamepad2,
  diner: Utensils,
  cine: Clapperboard,
  apero: Wine,
  balade: Footprints,
}

const moodLabels = {
  cafe: 'Café',
  jeux: 'Jeux',
  diner: 'Dîner',
  cine: 'Ciné',
  apero: 'Apéro',
  balade: 'Balade',
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ') || 'Ami'
}

function initials(profile) {
  const first = profile?.first_name?.[0] ?? ''
  const last = profile?.name?.[0] ?? ''
  return `${first}${last || (!first ? 'A' : '')}`.toUpperCase()
}

function monthLabel(date) {
  const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

function shortDayLabel(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

function fullDayLabel(dateKey) {
  const label = new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

function dayAbbreviation(dateKey) {
  return new Date(`${dateKey}T12:00:00`)
    .toLocaleDateString('fr-FR', { weekday: 'short' })
    .replace('.', '')
    .toUpperCase()
}

function relativeDayLabel(dateKey) {
  const target = new Date(`${dateKey}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Demain'
  if (diffDays === -1) return 'Hier'
  if (diffDays > 1) return `Dans ${diffDays} jours`
  return `Il y a ${Math.abs(diffDays)} jours`
}

function moodIconFor(moodKey) {
  return moodIcons[moodKey] || Sparkles
}

function avatar(profile, colorIndex, size = 36) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  const index = colorIndex % AVATAR_BACKGROUNDS.length
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: AVATAR_BACKGROUNDS[index],
        color: AVATAR_TEXT[index],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, size * 0.34),
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {initials(profile)}
    </div>
  )
}

function getMonthDays(currentMonth) {
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const cells = Array.from({ length: mondayOffset }, () => null)

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
  }

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function MoodChip({ moodKey }) {
  const Icon = moodIconFor(moodKey)

  return (
    <span className="dispoCalendarMoodChip">
      <Icon size={13} strokeWidth={2.3} />
      {moodLabels[moodKey] || moodKey}
    </span>
  )
}

function MoodMiniIcon({ moodKey }) {
  const Icon = moodIconFor(moodKey)
  return (
    <span className="dispoCalendarMoodMiniIcon">
      <Icon size={14} strokeWidth={2.25} />
    </span>
  )
}

export default function DispoCalendar({
  userId,
  posts = [],
  myPosts = [],
  currentMonth,
  onMonthChange,
  onDayClick,
  onEditPost,
  onDeletePost,
}) {
  const [activeTab, setActiveTab] = useState('mes')
  const [selectedDate, setSelectedDate] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [closeFriendIds, setCloseFriendIds] = useState([])
  const [friendAvailabilities, setFriendAvailabilities] = useState([])
  const [friendProfiles, setFriendProfiles] = useState([])
  const todayKey = toDateKey(new Date())
  const toggleCard = id => setOpenId(prev => (prev === id ? null : id))

  const monthStartKey = toDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1))
  const monthEndKey = toDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0))

  useEffect(() => {
    let cancelled = false

    async function fetchCloseFriends() {
      if (!userId) {
        setCloseFriendIds([])
        setFriendAvailabilities([])
        setFriendProfiles([])
        return
      }

      try {
        const { data: friendships, error: friendshipsError } = await supabase
          .from('friendships')
          .select('requester_id, addressee_id')
          .eq('status', 'accepted')
          .eq('is_close_friend', true)
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

        if (friendshipsError) throw friendshipsError

        const friendIds = [...new Set((friendships ?? []).map(f =>
          f.requester_id === userId ? f.addressee_id : f.requester_id
        ))]

        if (!friendIds.length) {
          if (!cancelled) {
            setCloseFriendIds([])
            setFriendAvailabilities([])
            setFriendProfiles([])
          }
          return
        }

        const [availabilityRes, profileRes] = await Promise.all([
          supabase
            .from('availabilities')
            .select('user_id, post_id, moods')
            .in('user_id', friendIds),
          supabase
            .from('profiles')
            .select('id, first_name, name, avatar_url')
            .in('id', friendIds),
        ])

        if (profileRes.error) throw profileRes.error
        if (availabilityRes.error) {
          console.warn('[DispoCalendar] fetch availabilities fallback:', availabilityRes.error)
        }

        if (!cancelled) {
          setCloseFriendIds(friendIds)
          setFriendAvailabilities(availabilityRes.error ? [] : (availabilityRes.data ?? []))
          setFriendProfiles(profileRes.data ?? [])
        }
      } catch (error) {
        console.error('[DispoCalendar] fetchCloseFriends error:', error)
        if (!cancelled) {
          setCloseFriendIds([])
          setFriendAvailabilities([])
          setFriendProfiles([])
        }
      }
    }

    fetchCloseFriends()

    return () => {
      cancelled = true
    }
  }, [userId])

  const { friendColorById, availabilityByDate, myDateKeys } = useMemo(() => {
    const friendsById = new Map()
    const byDate = new Map()
    const postById = new Map(posts.map(post => [post.id, post]))
    const profileById = new Map(friendProfiles.map(profile => [profile.id, profile]))

    posts.forEach(post => {
      if (!post.user_id) return
      const profile = post.profiles ?? profileById.get(post.user_id)
      if (!profile) return
      if (!friendsById.has(post.user_id)) friendsById.set(post.user_id, { id: post.user_id, profile })

      ;(post.available_dates ?? []).forEach(dateKey => {
        if (dateKey < monthStartKey || dateKey > monthEndKey) return
        const existing = byDate.get(dateKey) ?? new Map()
        const current = existing.get(post.user_id) ?? { id: post.user_id, profile, moods: new Set(), posts: [] }
        ;(post.moods ?? []).forEach(mood => current.moods.add(mood))
        current.posts.push(post)
        existing.set(post.user_id, current)
        byDate.set(dateKey, existing)
      })
    })

    friendAvailabilities.forEach(availability => {
      if (!availability.user_id) return
      const post = postById.get(availability.post_id)
      const profile = profileById.get(availability.user_id) ?? post?.profiles
      if (!profile) return
      if (!friendsById.has(availability.user_id)) friendsById.set(availability.user_id, { id: availability.user_id, profile })

      const dateKeys = Array.isArray(availability.available_dates)
        ? availability.available_dates
        : isDateKey(availability.post_id)
          ? [availability.post_id]
          : (post?.available_dates ?? [])

      dateKeys.forEach(dateKey => {
        if (dateKey < monthStartKey || dateKey > monthEndKey) return
        const existing = byDate.get(dateKey) ?? new Map()
        const current = existing.get(availability.user_id) ?? { id: availability.user_id, profile, moods: new Set(), posts: [] }
        ;(availability.moods ?? post?.moods ?? []).forEach(mood => current.moods.add(mood))
        if (post) current.posts.push(post)
        existing.set(availability.user_id, current)
        byDate.set(dateKey, existing)
      })
    })

    const monthFriendIds = new Set()
    byDate.forEach(friendMap => {
      friendMap.forEach((_availability, friendId) => monthFriendIds.add(friendId))
    })

    const visibleFriends = Array.from(friendsById.values()).filter(friend => (
      monthFriendIds.has(friend.id) || closeFriendIds.includes(friend.id)
    ))
    const colors = new Map(visibleFriends.map((friend, index) => [friend.id, index]))

    const myKeys = new Set()
    myPosts.forEach(post => {
      ;(post.available_dates ?? []).forEach(dateKey => {
        if (dateKey >= monthStartKey && dateKey <= monthEndKey) myKeys.add(dateKey)
      })
    })

    return { friendColorById: colors, availabilityByDate: byDate, myDateKeys: myKeys }
  }, [closeFriendIds, friendAvailabilities, friendProfiles, monthEndKey, monthStartKey, myPosts, posts])

  const bestDate = useMemo(() => {
    let best = null
    let bestCount = 0
    availabilityByDate.forEach((friendMap, dateKey) => {
      if (friendMap.size > bestCount) {
        best = dateKey
        bestCount = friendMap.size
      }
    })
    return bestCount > 0 ? best : null
  }, [availabilityByDate])

  const friendGroups = useMemo(() => (
    Array.from(availabilityByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, friendMap]) => ({
        dateKey,
        friends: Array.from(friendMap.entries()).map(([friendId, availability]) => ({
          id: friendId,
          profile: availability.profile,
          moods: Array.from(availability.moods),
        })),
      }))
  ), [availabilityByDate])

  const myAvailabilities = useMemo(() => (
    myPosts
      .flatMap(post => (post.available_dates ?? []).map(dateKey => ({
        id: `${post.id}-${dateKey}`,
        post,
        dateKey,
        moods: post.moods ?? [],
      })))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  ), [myPosts])

  const days = getMonthDays(currentMonth)
  const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  const changeMonth = amount => {
    setSelectedDate(null)
    onMonthChange?.(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1))
  }

  return (
    <div className="dispoCalendarRoot">
      <style>{`
        .dispoCalendarRoot {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
          --color-text-primary: #1C1C1E;
          --color-text-secondary: #8E8E93;
          --color-background-secondary: #F2F2F7;
          --color-border-secondary: rgba(60,60,67,0.24);
          --color-border-tertiary: rgba(60,60,67,0.12);
          color: #1C1C1E;
        }
        .dispoCalendarTabs {
          display: flex;
          gap: 4px;
          background: #fff;
          border-radius: 14px;
          padding: 4px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.06);
          margin-bottom: 12px;
        }
        .dispoCalendarTab {
          flex: 1;
          height: 36px;
          border: none;
          border-radius: 11px;
          background: #fff;
          color: #8E8E93;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .dispoCalendarTab.active {
          background: linear-gradient(135deg, #e055aa, #f5a623);
          color: #fff;
          font-weight: 600;
        }
        .dispoCalendarCard {
          background: #fff;
          border-radius: 16px;
          border: 0.5px solid rgba(0,0,0,0.07);
          padding: 14px;
        }
        .dispoCalendarMonthNav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .dispoCalendarNavButton {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: #F2F2F7;
          color: #8E8E93;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .dispoCalendarGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 7px;
        }
        .dispoCalendarWeekday {
          height: 24px;
          color: #8E8E93;
          font-size: 11px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dispoCalendarDay {
          min-height: 48px;
          border-radius: 12px;
          border: 1.5px solid transparent;
          background: transparent;
          padding: 5px 3px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          cursor: default;
        }
        .dispoCalendarDay.clickable {
          cursor: pointer;
        }
        .dispoCalendarDay.hasDispo {
          cursor: pointer;
        }
        .dispoCalendarDay.selected {
          outline: 1.5px solid rgba(224,85,170,0.35);
          outline-offset: -1.5px;
        }
        .dispoCalendarDayNumber {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          color: #1C1C1E;
          position: relative;
        }
        .dispoCalendarDay.best .dispoCalendarDayNumber {
          background: linear-gradient(135deg,#e055aa,#f5a623);
          color: #fff;
        }
        .dispoCalendarDay.today .dispoCalendarDayNumber {
          background: #1C1C1E;
          color: #fff;
        }
        .dispoCalendarDots {
          position: absolute;
          left: 50%;
          bottom: -8px;
          transform: translateX(-50%);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 3px;
        }
        .dispoCalendarDot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          flex: 0 0 auto;
        }
        .dispoCalendarLegend {
          display: flex;
          gap: 12px;
          margin-top: 14px;
        }
        .dispoCalendarLegendItem {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #8E8E93;
          font-size: 11px;
          font-weight: 700;
        }
        .dispoCalendarListTitle {
          font-size: 14px;
          font-weight: 900;
          margin: 16px 2px 10px;
        }
        .dispoCalendarListCard {
          margin-top: 14px;
          background: #fff;
          border-radius: 16px;
          border: 0.5px solid rgba(0,0,0,0.07);
          padding: 14px;
        }
        .dispoCalendarListCard + .dispoCalendarListCard {
          margin-top: 10px;
        }
        .dispoCalendarDatePills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }
        .dispoCalendarDatePill {
          border-radius: 999px;
          background: linear-gradient(135deg,#e055aa,#f5a623);
          color: #fff;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 800;
        }
        .dispoCalendarMoodChips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .dispoCalendarMoodChip {
          border-radius: 20px;
          background: var(--color-background-secondary);
          border: 0.5px solid var(--color-border-tertiary);
          color: #3A3A3C;
          padding: 6px 11px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 500;
        }
        .dispoCalendarMyHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 16px 0;
        }
        .dispoCalendarMyTitle {
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .dispoCalendarMyCount {
          font-size: 12px;
          font-weight: 600;
          color: #e055aa;
          background: #fbeaf0;
          padding: 4px 10px;
          border-radius: 20px;
        }
        .dispoCalendarMyCard {
          margin-top: 10px;
          background: #fff;
          border-radius: 16px;
          border: 0.5px solid var(--color-border-tertiary);
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.22s ease, box-shadow 0.22s ease;
        }
        .dispoCalendarMyCard.open {
          border-color: #e055aa;
        }
        .dispoCalendarMyCompact {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
        }
        .dispoCalendarDateIcon {
          width: 44px;
          height: 44px;
          border-radius: 13px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 0 0 44px;
        }
        .dispoCalendarDateIconDay {
          font-size: 19px;
          line-height: 1;
          font-weight: 800;
        }
        .dispoCalendarDateIconWeekday {
          margin-top: 3px;
          font-size: 9px;
          line-height: 1;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .dispoCalendarMyInfo {
          flex: 1;
          min-width: 0;
        }
        .dispoCalendarMyDate {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dispoCalendarMyRelative {
          margin-top: 2px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .dispoCalendarMoodMiniRow {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 7px;
          min-height: 28px;
        }
        .dispoCalendarMoodMiniIcon {
          width: 28px;
          height: 28px;
          border-radius: 9px;
          background: var(--color-background-secondary);
          border: 0.5px solid var(--color-border-tertiary);
          color: #3A3A3C;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 28px;
        }
        .dispoCalendarMoodMore {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-secondary);
        }
        .dispoCalendarMyChevron {
          color: var(--color-text-secondary);
          flex: 0 0 auto;
          transition: transform 0.22s ease;
        }
        .dispoCalendarMyCard.open .dispoCalendarMyChevron {
          transform: rotate(180deg);
        }
        .dispoCalendarMyDetailWrap {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.28s ease;
        }
        .dispoCalendarMyCard.open .dispoCalendarMyDetailWrap {
          max-height: 300px;
        }
        .dispoCalendarMyDetail {
          border-top: 0.5px solid var(--color-border-tertiary);
          padding: 12px 16px 14px;
        }
        .dispoCalendarMyDetailLabel {
          margin-bottom: 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--color-text-secondary);
        }
        .dispoCalendarMyDetail .dispoCalendarMoodChips {
          margin-bottom: 14px;
        }
        .dispoCalendarMyActions {
          display: flex;
          gap: 8px;
        }
        .dispoCalendarMyEditButton {
          flex: 1;
          min-width: 0;
          border: 0.5px solid var(--color-border-tertiary);
          border-radius: 12px;
          background: var(--color-background-secondary);
          color: var(--color-text-primary);
          padding: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .dispoCalendarMyDeleteButton {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 0.5px solid #F4C0D1;
          background: #fbeaf0;
          color: #993556;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 42px;
          cursor: pointer;
        }
        .dispoCalendarAddDispoButton {
          width: 100%;
          margin-top: 12px;
          border: 1.5px dashed var(--color-border-secondary);
          border-radius: 18px;
          padding: 14px;
          background: transparent;
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .dispoCalendarFriendRow {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
        }
        .dispoCalendarFriendRow + .dispoCalendarFriendRow {
          border-top: 0.5px solid rgba(0,0,0,0.07);
        }
        .dispoCalendarMoodIcon {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: #F2F2F7;
          color: #888;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dispoCalendarActions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 12px;
        }
        .dispoCalendarTextButton {
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          padding: 4px;
        }
        .dispoCalendarEmpty {
          margin-top: 14px;
          background: #fff;
          border-radius: 16px;
          border: 0.5px solid rgba(0,0,0,0.07);
          padding: 14px;
          color: #8E8E93;
          font-size: 13px;
          font-weight: 700;
        }
      `}</style>

      <div className="dispoCalendarTabs" role="tablist" aria-label="Vue des disponibilités">
        <button
          type="button"
          className={`dispoCalendarTab ${activeTab === 'mes' ? 'active' : ''}`}
          onClick={() => setActiveTab('mes')}
        >
          Mes dispos
        </button>
        <button
          type="button"
          className={`dispoCalendarTab ${activeTab === 'amis' ? 'active' : ''}`}
          onClick={() => setActiveTab('amis')}
        >
          Amis proches
        </button>
      </div>

      <div className="dispoCalendarCard">
        <div className="dispoCalendarMonthNav">
          <button className="dispoCalendarNavButton" type="button" onClick={() => changeMonth(-1)} aria-label="Mois precedent">
            <ChevronLeft size={18} strokeWidth={2.4} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{monthLabel(currentMonth)}</div>
          <button className="dispoCalendarNavButton" type="button" onClick={() => changeMonth(1)} aria-label="Mois suivant">
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className="dispoCalendarGrid">
          {weekdays.map((weekday, index) => (
            <div key={`${weekday}-${index}`} className="dispoCalendarWeekday">{weekday}</div>
          ))}
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} />
            const dateKey = toDateKey(day)
            const friendIds = Array.from((availabilityByDate.get(dateKey) ?? new Map()).keys())
            const hasDispo = friendIds.length > 0
            const isPast = dateKey < todayKey
            const hasMeDispo = myDateKeys.has(dateKey)
            const className = [
              'dispoCalendarDay',
              !isPast ? 'clickable' : '',
              hasDispo ? 'hasDispo' : '',
              dateKey === bestDate ? 'best' : '',
              dateKey === todayKey ? 'today' : '',
              dateKey === selectedDate ? 'selected' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                key={dateKey}
                className={className}
                type="button"
                disabled={isPast}
                onClick={() => {
                  if (hasDispo || hasMeDispo) setSelectedDate(dateKey)
                  onDayClick?.(dateKey)
                }}
              >
                <span className="dispoCalendarDayNumber">
                  {day.getDate()}
                  {(hasMeDispo || hasDispo) && (
                    <span className="dispoCalendarDots">
                      {hasMeDispo && <span className="dispoCalendarDot" style={{ background: '#007AFF' }} />}
                      {hasDispo && <span className="dispoCalendarDot" style={{ background: '#e055aa' }} />}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="dispoCalendarLegend">
          <div className="dispoCalendarLegendItem">
            <span className="dispoCalendarDot" style={{ background: '#007AFF' }} />
            Mes dispos
          </div>
          <div className="dispoCalendarLegendItem">
            <span className="dispoCalendarDot" style={{ background: '#e055aa' }} />
            Amis proches
          </div>
        </div>
      </div>

      {activeTab === 'mes' ? (
        <>
          <div className="dispoCalendarMyHeader">
            <span className="dispoCalendarMyTitle">Mes dispos</span>
            <span className="dispoCalendarMyCount">{myAvailabilities.length} cette semaine</span>
          </div>
          {myAvailabilities.length > 0 ? (
            myAvailabilities.map((dispo, index) => {
              const open = openId === dispo.id
              const date = new Date(`${dispo.dateKey}T12:00:00`)
              const palette = index % 2 === 0
                ? { background: '#fbeaf0', dayColor: '#993556', labelColor: '#D4537E' }
                : { background: '#faeeda', dayColor: '#854F0B', labelColor: '#BA7517' }
              const visibleMoods = dispo.moods.slice(0, 4)
              const hiddenMoodCount = Math.max(0, dispo.moods.length - visibleMoods.length)

              return (
                <div
                  key={dispo.id}
                  className={`dispoCalendarMyCard ${open ? 'open' : ''}`}
                  onClick={() => toggleCard(dispo.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleCard(dispo.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                >
                  <div className="dispoCalendarMyCompact">
                    <div className="dispoCalendarDateIcon" style={{ background: palette.background }}>
                      <span className="dispoCalendarDateIconDay" style={{ color: palette.dayColor }}>
                        {date.getDate()}
                      </span>
                      <span className="dispoCalendarDateIconWeekday" style={{ color: palette.labelColor }}>
                        {dayAbbreviation(dispo.dateKey)}
                      </span>
                    </div>
                    <div className="dispoCalendarMyInfo">
                      <div className="dispoCalendarMyDate">{fullDayLabel(dispo.dateKey)}</div>
                      <div className="dispoCalendarMyRelative">{relativeDayLabel(dispo.dateKey)}</div>
                      <div className="dispoCalendarMoodMiniRow">
                        {visibleMoods.map(moodKey => <MoodMiniIcon key={moodKey} moodKey={moodKey} />)}
                        {hiddenMoodCount > 0 && <span className="dispoCalendarMoodMore">+{hiddenMoodCount}</span>}
                      </div>
                    </div>
                    <ChevronDown className="dispoCalendarMyChevron" size={16} strokeWidth={2.4} />
                  </div>
                  <div className="dispoCalendarMyDetailWrap">
                    <div className="dispoCalendarMyDetail">
                      <div className="dispoCalendarMyDetailLabel">Activités</div>
                      <div className="dispoCalendarMoodChips">
                        {dispo.moods.map(moodKey => <MoodChip key={moodKey} moodKey={moodKey} />)}
                      </div>
                      <div className="dispoCalendarMyActions">
                        <button
                          type="button"
                          className="dispoCalendarMyEditButton"
                          onClick={event => {
                            event.stopPropagation()
                            onEditPost?.(dispo.post)
                          }}
                        >
                          <Edit size={15} strokeWidth={2.25} />
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="dispoCalendarMyDeleteButton"
                          onClick={event => {
                            event.stopPropagation()
                            onDeletePost?.(dispo.post.id)
                          }}
                          aria-label="Supprimer"
                        >
                          <Trash size={16} strokeWidth={2.25} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="dispoCalendarEmpty">Aucune dispo pour le moment.</div>
          )}
          <button
            type="button"
            className="dispoCalendarAddDispoButton"
            onClick={() => onDayClick?.()}
          >
            <Plus size={18} strokeWidth={2.4} />
            Ajouter une dispo
          </button>
        </>
      ) : (
        friendGroups.length > 0 ? (
          <>
            <div className="dispoCalendarListTitle">Amis proches</div>
            {friendGroups.map(group => (
              <div key={group.dateKey} className="dispoCalendarListCard">
                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>
                  {shortDayLabel(group.dateKey)}
                </div>
                {group.friends.map(friend => {
                  const colorIndex = friendColorById.get(friend.id) ?? 0
                  return (
                    <div key={`${group.dateKey}-${friend.id}`} className="dispoCalendarFriendRow">
                      {avatar(friend.profile, colorIndex)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {friend.profile?.first_name || displayName(friend.profile)}
                        </div>
                        <div className="dispoCalendarMoodChips">
                          {friend.moods.map(moodKey => <MoodChip key={moodKey} moodKey={moodKey} />)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        ) : (
          <div className="dispoCalendarEmpty">Aucun ami proche disponible ce mois-ci.</div>
        )
      )}
    </div>
  )
}
