import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { normalizeStatus } from './InvitationsSection'

export const EVENT_GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'

export function getCoverUrl(coverImage) {
  if (!coverImage) return null
  if (coverImage.startsWith('http')) return coverImage
  return supabase.storage.from('event-covers').getPublicUrl(coverImage).data.publicUrl
}

export function formatCompactEventDate(dateStr) {
  if (!dateStr) return 'Date à définir'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Date à définir'
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function getEventDaysLeft(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
}

export function countStatuses(rows = []) {
  return rows.reduce((acc, row) => {
    const status = normalizeStatus(row.status || row.response)
    if (status === 'yes') acc.yes += 1
    else if (status === 'no') acc.no += 1
    else acc.maybe += 1
    return acc
  }, { yes: 0, no: 0, maybe: 0 })
}

function MiniEventStatusChip({ item }) {
  const isOrganizer = item.role === 'organise'
  const normalized = normalizeStatus(item.myStatus)
  const chip = isOrganizer
    ? { label: '✦ Organisateur', bg: 'rgba(255,255,255,0.18)', color: '#fff' }
    : normalized === 'yes'
      ? { label: '✦ Invité', bg: 'rgba(255,255,255,0.18)', color: '#fff', glass: true }
      : { label: 'En attente', bg: '#F2F2F7', color: '#8E8E93' }

  return (
    <span style={{
      padding: '3px 8px',
      borderRadius: 20,
      display: 'inline-flex',
      alignItems: 'center',
      background: chip.bg,
      color: chip.color,
      fontSize: 10,
      fontWeight: 600,
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      minWidth: 0,
      maxWidth: '100%',
      flexShrink: 1,
      ...(chip.glass && {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.35)',
      }),
    }}>
      {chip.label}
    </span>
  )
}

function MyEventMiniCard({ item, onClick }) {
  const daysLeft = getEventDaysLeft(item.date)
  const coverUrl = getCoverUrl(item.cover_image)
  const hasCover = !!coverUrl
  const dateStr = formatCompactEventDate(item.date)
  const stats = item.rsvpStats ?? { yes: 0, maybe: 0, no: 0 }

  return (
    <div
      onClick={() => onClick?.(item)}
      style={{
        width: 'clamp(148px, calc((100vw - 48px) / 2.2), 172px)',
        height: 160,
        flexShrink: 0,
        position: 'relative',
        background: hasCover ? '#000' : 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)',
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(18,31,46,0.08)',
      }}
    >
      {hasCover ? (
        <img src={coverUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : null}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.04) 38%, rgba(0,0,0,0.68) 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        left: 10,
        right: 10,
        top: 10,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        minWidth: 0,
        overflow: 'hidden',
      }}>
        <MiniEventStatusChip item={item} />
        <div style={{
          borderRadius: 8,
          background: 'rgba(0,0,0,0.38)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          padding: '3px 8px',
          lineHeight: 1.15,
          flexShrink: 0,
        }}>
          {daysLeft === null ? 'J-?' : `J-${Math.max(daysLeft, 0)}`}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: 10,
        textShadow: '0 1px 4px rgba(0,0,0,0.28)',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontSize: 14, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name || 'Événement'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 10, color: 'rgba(255,255,255,0.86)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dateStr}{item.location ? ` · ${item.location}` : ''}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.86)', fontSize: 10, lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.yes} oui
          </span>
        </div>
      </div>
    </div>
  )
}

function CreateEventMiniCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 'clamp(148px, calc((100vw - 48px) / 2.2), 172px)',
        height: 160,
        flexShrink: 0,
        border: '1.5px dashed #e0d8ea',
        background: 'transparent',
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        padding: 12,
        cursor: 'pointer',
      }}
    >
      <span style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        display: 'grid',
        placeItems: 'center',
        background: EVENT_GRADIENT,
      }}>
        <Plus size={20} color="#fff" strokeWidth={2.6} />
      </span>
      <span style={{ width: '100%', minWidth: 0, maxWidth: '100%', fontSize: 11, fontWeight: 600, color: '#c0b0cc', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Créer un événement
      </span>
    </button>
  )
}

export default function MyEventsSection({ events, onSeeAll, onEventClick, onCreateClick }) {
  return (
    <div style={{ margin: '0 -16px 12px', background: 'var(--bg)' }}>
      <style>{`
        .home-my-events-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--gray1)',
          }}>
            MES ÉVÉNEMENTS
          </span>
        </div>
        <button
          onClick={onSeeAll}
          style={{
            border: 'none',
            background: 'transparent',
            backgroundImage: EVENT_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: 13,
            fontWeight: 600,
            padding: 0,
            cursor: 'pointer',
          }}
        >
          Voir tout
        </button>
      </div>
      <div
        className="home-my-events-scroll"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 12,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '4px 20px 8px',
          background: 'transparent',
        }}
      >
        {events.map(event => (
          <MyEventMiniCard
            key={event.id}
            item={event}
            onClick={onEventClick}
          />
        ))}
        <CreateEventMiniCard onClick={onCreateClick} />
      </div>
    </div>
  )
}
