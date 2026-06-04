import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const AMIV_GRADIENT = 'linear-gradient(160deg, #e055aa, #f5a623)'
const AMIV_GRADIENT_135 = 'linear-gradient(135deg, #e055aa, #f5a623)'

function getCoverUrl(coverImage) {
  if (!coverImage) return null
  if (coverImage.startsWith('http')) return coverImage
  return supabase.storage.from('event-covers').getPublicUrl(coverImage).data.publicUrl
}

function titleCase(value, fallback = 'Événement') {
  const text = (value || fallback).trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
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

function normalizeStatus(status) {
  if (status === 'going' || status === 'yes' || status === 'accepted' || status === 'confirmed' || status === 'organizing') return 'yes'
  if (status === 'maybe' || status === 'invited' || status === 'pending') return 'maybe'
  if (status === 'declined' || status === 'no' || status === 'not_going') return 'no'
  return status || null
}

function OrganizerEventCard({ event, stats, dateParts, openEvent, openChat }) {
  const [hovering, setHovering] = useState(false)
  const coverUrl = getCoverUrl(event.cover_image)
  const yesCount = getYesCount(stats, event)
  const title = titleCase(event.name, 'Événement')
  const details = `${dateParts.longDate} · ${dateParts.time}${event.location ? ` · ${event.location}` : ''}`
  const isDeclined = normalizeStatus(event.rsvpStatus) === 'no'
  const avatarGradients = [
    'linear-gradient(135deg,#e055aa,#f5a623)',
    'linear-gradient(135deg,#f5a623,#e055aa)',
    'linear-gradient(135deg,#c044aa,#e8821a)',
  ]

  return (
    <article
      onClick={openEvent}
      onMouseEnter={e => {
        setHovering(true)
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.13)'
      }}
      onMouseLeave={e => {
        setHovering(false)
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.07)'
      }}
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        background: '#fff',
        border: 'none',
        boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        marginBottom: 16,
        cursor: 'pointer',
        opacity: isDeclined ? 0.6 : 1,
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
      }}
    >
      <div style={{
        height: 200,
        position: 'relative',
        overflow: 'hidden',
        background: coverUrl ? '#1a0a12' : 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)',
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
              opacity: 1,
              transform: hovering ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.5s ease',
            }}
          />
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
        }} />

        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '7px 13px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: 'none',
          textAlign: 'center',
          minWidth: 54,
        }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1C1C1E', lineHeight: 1 }}>{dateParts.day}</div>
          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: '#8E8E93' }}>{dateParts.month}</div>
        </div>

        {isDeclined && (
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            borderRadius: 20,
            padding: '5px 13px',
            background: 'rgba(142,142,147,0.92)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.2,
            boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
          }}>
            Décliné
          </div>
        )}

        {dateParts.badge && !isDeclined && (
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            borderRadius: 20,
            padding: '5px 13px',
            background: AMIV_GRADIENT_135,
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.2,
            boxShadow: '0 3px 10px rgba(224,85,170,0.4)',
          }}>
            {dateParts.badge}
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, minWidth: 0 }}>
          {(event.isOrganizer || event.rsvpStatus === 'organizing') && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 10,
              padding: '3px 9px',
              marginBottom: 6,
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: 0.2,
            }}>
              ✦ Organisateur
            </div>
          )}
          <div style={{
            color: '#fff',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.3,
            lineHeight: 1.15,
            textShadow: '0 1px 6px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{
            marginTop: 4,
            color: 'rgba(255,255,255,0.82)',
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {details}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 14px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {avatarGradients.map((background, i) => (
              <div
                key={background}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background,
                  border: '2px solid #fff',
                  marginLeft: i === 0 ? 0 : -8,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          <div style={{ color: '#3D3D3D', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 0 }}>
            {yesCount} participants
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              openChat()
            }}
            style={{
              marginLeft: 'auto',
              color: '#e055aa',
              fontWeight: 700,
              fontSize: 13,
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: 0,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <MessageCircle size={15} strokeWidth={2.2} />
            Chat
          </button>
        </div>
      </div>
    </article>
  )
}

export default function EventCard({
  event: eventProp,
  item,
  onClick,
  onOpen,
  onChat,
}) {
  const navigate = useNavigate()
  const baseEvent = item?.event ?? eventProp ?? {}
  const event = item?.event
    ? {
        ...baseEvent,
        isOrganizer: baseEvent.isOrganizer ?? item.isOrganizer,
        rsvpStatus: baseEvent.rsvpStatus ?? (item.isOrganizer ? 'organizing' : item.myStatus),
      }
    : baseEvent
  const stats = item?.stats ?? event.rsvpStats ?? {}
  const dateParts = getLocalDateParts(event.date)

  const openEvent = () => {
    if (onOpen) onOpen(event)
    else if (onClick) onClick(event)
    else if (event.id) navigate(`/events/${event.id}`)
  }

  const openChat = () => {
    if (onChat) onChat(event)
    else if (event.id) navigate(`/events/${event.id}/chat`)
  }

  return (
    <OrganizerEventCard
      event={event}
      stats={stats}
      dateParts={dateParts}
      openEvent={openEvent}
      openChat={openChat}
    />
  )
}
