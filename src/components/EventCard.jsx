import { CalendarDays, Eye, MessageCircle, Settings, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const AMIV_GRADIENT = 'linear-gradient(160deg, #e055aa, #f5a623)'
const AMIV_GRADIENT_135 = 'linear-gradient(135deg, #e055aa, #f5a623)'
const AMIV_GRADIENT_90 = 'linear-gradient(90deg, #e055aa, #f5a623)'

function getCoverUrl(coverImage) {
  if (!coverImage) return null
  if (coverImage.startsWith('http')) return coverImage
  return supabase.storage.from('event-covers').getPublicUrl(coverImage).data.publicUrl
}

function titleCase(value, fallback = 'Événement') {
  const text = (value || fallback).trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function normalizeStatus(status) {
  if (status === 'yes' || status === 'going' || status === 'accepted' || status === 'confirmed') return 'yes'
  if (status === 'no' || status === 'declined' || status === 'not_going') return 'no'
  if (status === 'maybe' || status === 'invited' || status === 'pending') return 'maybe'
  if (status === 'organizer' || status === 'organizing') return 'organizer'
  return status || null
}

function getLocalDateParts(dateStr) {
  const date = dateStr ? new Date(dateStr) : null
  if (!date || Number.isNaN(date.getTime())) {
    return {
      day: '--',
      month: 'DATE',
      weekday: '',
      time: 'Heure à préciser',
      daysLeft: null,
      badge: null,
    }
  }

  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startEvent = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysLeft = Math.ceil((startEvent - startToday) / 86400000)

  return {
    day: date.toLocaleDateString('fr-FR', { day: 'numeric' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
    time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    longDate: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }),
    daysLeft,
    badge: daysLeft < 0 ? null : daysLeft === 0 ? "Aujourd'hui" : `J-${daysLeft}`,
  }
}

function getYesCount(stats, event) {
  if (Number.isFinite(stats?.yes)) return stats.yes
  if (Number.isFinite(event?.rsvpStats?.yes)) return event.rsvpStats.yes
  if (Number.isFinite(event?.yesCount)) return event.yesCount
  if (Number.isFinite(event?.yes_count)) return event.yes_count
  return 0
}

function getMaybeCount(stats, event) {
  if (Number.isFinite(stats?.maybe)) return stats.maybe
  if (Number.isFinite(event?.rsvpStats?.maybe)) return event.rsvpStats.maybe
  if (Number.isFinite(event?.maybeCount)) return event.maybeCount
  if (Number.isFinite(event?.maybe_count)) return event.maybe_count
  return 0
}

function getTotalCount(stats, event) {
  if (Number.isFinite(stats?.total)) return stats.total
  const yes = getYesCount(stats, event)
  const maybe = getMaybeCount(stats, event)
  const no = Number.isFinite(stats?.no)
    ? stats.no
    : Number.isFinite(event?.rsvpStats?.no)
      ? event.rsvpStats.no
      : 0
  return yes + maybe + no
}

function fallbackCalendar(event) {
  if (!event?.date) return
  const start = new Date(event.date)
  if (Number.isNaN(start.getTime())) return
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const format = value => value.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name || 'Amiv')}&dates=${format(start)}/${format(end)}&location=${encodeURIComponent(event.location || '')}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function fallbackShare(event) {
  const token = event?.invite_token || event?.share_token
  const url = token ? `${window.location.origin}/invite/${token}` : `${window.location.origin}/events/${event?.id}`
  const text = `Tu es invité(e) ! Rejoins l'événement sur Amiv : ${url}`
  if (navigator.share) {
    navigator.share({ title: event?.name || 'Amiv', text, url }).catch(() => {})
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(url)
  }
}

function RoundIconButton({ icon: Icon, label, onClick, size = 26, iconSize = 13 }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: size / 2,
        background: 'var(--gray3)',
        color: 'var(--black)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Icon size={iconSize} strokeWidth={2.2} />
    </button>
  )
}

function Chip({ children, tone = 'gray' }) {
  const isGreen = tone === 'green'
  return (
    <span style={{
      height: 24,
      maxWidth: '100%',
      padding: '2px 8px',
      borderRadius: 20,
      background: isGreen ? 'rgba(52,199,89,0.14)' : 'var(--gray3)',
      color: isGreen ? '#178C3B' : 'var(--gray1)',
      fontSize: 10,
      fontWeight: 800,
      display: 'inline-flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      lineHeight: 1,
    }}>
      {children}
    </span>
  )
}

function CompactEventCard({ event, stats, dateParts, openEvent, openChat, onCalendar, isGoing }) {
  const yesCount = getYesCount(stats, event)
  const title = titleCase(event.name, 'Événement')
  const subtitle = `${dateParts.time}${event.location ? ` · ${event.location}` : ''}`
  return (
    <article
      onClick={openEvent}
      style={{
        height: 88,
        borderRadius: 20,
        background: 'var(--white)',
        border: '0.5px solid rgba(0,0,0,0.08)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        marginBottom: 12,
        display: 'flex',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 60,
        flexShrink: 0,
        background: AMIV_GRADIENT,
        color: 'var(--white)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 0.9 }}>{dateParts.day}</div>
        <div style={{ marginTop: 5, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.85)' }}>
          {dateParts.month}
        </div>
        <div style={{ marginTop: 3, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
          {dateParts.weekday}
        </div>
      </div>

      <div style={{
        minWidth: 0,
        flex: 1,
        padding: '10px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        <div style={{ minWidth: 0, position: 'relative', paddingRight: dateParts.badge ? 90 : 0 }}>
          <div style={{
            color: 'var(--black)',
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.22,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{
            marginTop: 4,
            color: 'var(--gray1)',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {subtitle}
          </div>
          {dateParts.badge && (
            <span style={{
              position: 'absolute',
              top: -1,
              right: 0,
              maxWidth: 84,
              borderRadius: 20,
              padding: '3px 9px',
              background: AMIV_GRADIENT,
              color: 'var(--white)',
              fontSize: 11,
              fontWeight: 800,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {dateParts.badge}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
            {isGoing && <Chip tone="green">✓ J'y serai</Chip>}
            <Chip>{yesCount} oui</Chip>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <RoundIconButton icon={Eye} label="Voir" onClick={openEvent} />
            <RoundIconButton icon={MessageCircle} label="Chat" onClick={openChat} />
            <RoundIconButton icon={CalendarDays} label="Agenda" onClick={() => onCalendar ? onCalendar(event) : fallbackCalendar(event)} />
          </div>
        </div>
      </div>
    </article>
  )
}

function FooterButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      style={{
        minWidth: 0,
        padding: '9px 0',
        borderRadius: 12,
        background: 'var(--gray3)',
        border: '0.5px solid var(--color-border-tertiary, rgba(0,0,0,0.08))',
        color: 'var(--black)',
        fontSize: 12,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
      }}
    >
      <Icon size={15} strokeWidth={2.2} />
      {label}
    </button>
  )
}

function OrganizerEventCard({ event, stats, dateParts, openEvent, manageEvent, openChat, onShare }) {
  const coverUrl = getCoverUrl(event.cover_image)
  const yesCount = getYesCount(stats, event)
  const maybeCount = getMaybeCount(stats, event)
  const totalCount = getTotalCount(stats, event)
  const progress = totalCount > 0 ? Math.min(100, Math.max(0, Math.round((yesCount / totalCount) * 100))) : 0
  const title = titleCase(event.name, 'Événement')
  const details = `${dateParts.longDate} · ${dateParts.time}${event.location ? ` · ${event.location}` : ''}`

  return (
    <article
      onClick={openEvent}
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        background: 'var(--color-background-primary, var(--white))',
        border: '0.5px solid rgba(0,0,0,0.08)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{
        height: 160,
        position: 'relative',
        overflow: 'hidden',
        background: coverUrl ? '#1a0a12' : 'linear-gradient(135deg, #1a0a12, #3d1230)',
      }}>
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.45,
            }}
          />
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)',
        }} />

        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '8px 12px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '0.5px solid rgba(255,255,255,0.25)',
          color: 'var(--white)',
          textAlign: 'center',
          minWidth: 54,
        }}>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 0.95 }}>{dateParts.day}</div>
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{dateParts.month}</div>
        </div>

        {dateParts.badge && (
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            borderRadius: 20,
            padding: '5px 12px',
            background: AMIV_GRADIENT_135,
            color: 'var(--white)',
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.2,
          }}>
            {dateParts.badge}
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, minWidth: 0 }}>
          <div style={{
            color: 'var(--white)',
            fontSize: 18,
            fontWeight: 800,
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{
            marginTop: 5,
            color: 'rgba(255,255,255,0.75)',
            fontSize: 12,
            fontWeight: 650,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {details}
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: AMIV_GRADIENT,
            color: 'var(--white)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 8,
            fontWeight: 900,
            flexShrink: 0,
          }}>
            AM
          </div>
          <div style={{ color: 'var(--gray1)', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
            {yesCount} oui · {maybeCount} att.
          </div>
        </div>

        <div style={{ height: 3, borderRadius: 2, background: 'var(--gray3)', overflow: 'hidden', margin: '8px 0' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 2,
            background: AMIV_GRADIENT_90,
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <FooterButton icon={Settings} label="Gérer" onClick={manageEvent} />
          <FooterButton icon={MessageCircle} label="Chat" onClick={openChat} />
          <FooterButton icon={Share2} label="Partager" onClick={() => onShare ? onShare(event) : fallbackShare(event)} />
        </div>
      </div>
    </article>
  )
}

export default function EventCard({
  event: eventProp,
  item,
  currentUser,
  onClick,
  onOpen,
  onManage,
  onChat,
  onShare,
  onCalendar,
}) {
  const navigate = useNavigate()
  const event = item?.event ?? eventProp ?? {}
  const currentUserId = currentUser?.id
  const fallbackOrganizer = item?.isOrganizer ?? event.isOrganizer ?? ['organizer', 'organise', 'organizing'].includes(event.role)
  const isOrganizer = currentUserId ? event.user_id === currentUserId : fallbackOrganizer
  const status = normalizeStatus(item?.myStatus ?? event.myStatus ?? event.rsvpStatus ?? event.status)
  const stats = item?.stats ?? event.rsvpStats ?? {}
  const dateParts = getLocalDateParts(event.date)
  const isGoing = status === 'yes'

  const openEvent = () => {
    if (onOpen) onOpen(event)
    else if (onClick) onClick(event)
    else if (event.id) navigate(`/events/${event.id}`)
  }

  const manageEvent = () => {
    if (onManage) onManage(event)
    else if (event.id) navigate(`/events/${event.id}/manage`)
  }

  const openChat = () => {
    if (onChat) onChat(event)
    else if (event.id) navigate(`/events/${event.id}/chat`)
  }

  return isOrganizer ? (
    <OrganizerEventCard
      event={event}
      stats={stats}
      dateParts={dateParts}
      openEvent={openEvent}
      manageEvent={manageEvent}
      openChat={openChat}
      onShare={onShare}
    />
  ) : (
    <CompactEventCard
      event={event}
      stats={stats}
      dateParts={dateParts}
      openEvent={openEvent}
      openChat={openChat}
      onCalendar={onCalendar}
      isGoing={isGoing}
    />
  )
}
