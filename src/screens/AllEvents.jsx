import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TITLE_GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'

function formatEventDate(date) {
  return date
    ? new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Date à définir'
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

function normalizeStatus(status) {
  if (status === 'going' || status === 'yes' || status === 'accepted' || status === 'confirmed') return 'yes'
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

function getInitial(profile, fallback = 'A') {
  return (profile?.first_name || profile?.name || profile?.email || fallback || 'A').charAt(0).toUpperCase()
}

function StatusChip({ status }) {
  const normalized = normalizeStatus(status)
  const chip = normalized === 'yes'
    ? { label: "✓ J'y serai", bg: 'rgba(52,199,89,0.12)', color: '#178C3B' }
    : normalized === 'maybe'
      ? { label: 'En attente', bg: 'rgba(245,166,35,0.15)', color: '#A35E00' }
      : normalized === 'no'
        ? { label: 'Décliné', bg: 'rgba(255,59,48,0.10)', color: '#D12A22' }
        : { label: 'En attente', bg: '#F2F2F7', color: '#6B6B72' }

  return (
    <span style={{
      minHeight: 26,
      padding: '6px 9px',
      borderRadius: 999,
      display: 'inline-flex',
      alignItems: 'center',
      background: chip.bg,
      color: chip.color,
      fontSize: 11,
      fontWeight: 800,
      lineHeight: 1,
    }}>
      {chip.label}
    </span>
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
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
          ) : getInitial(profile, 'I')}
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

function EventCard({ event, onClick, onCoverUploaded }) {
  const inputRef = useRef(null)
  const { name = 'Événement', date, location } = event
  const dateStr = formatEventDate(date)
  const hasCover = !!event.cover_image
  const countdown = getCountdown(date)
  const stats = event.rsvpStats ?? { yes: 0, maybe: 0, no: 0 }
  const total = stats.yes + stats.maybe + stats.no
  const progress = total > 0 ? Math.round((stats.yes / total) * 100) : 0
  const canUploadCover = event.isOrganizer

  async function handleCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file || !event.id || !canUploadCover) return
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
      onClick={() => onClick?.(event)}
      style={{
        background: '#fff',
        borderRadius: 16,
        marginBottom: 10,
        boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ height: 110, position: 'relative', background: event.id?.charCodeAt?.(0) % 2 ? '#fff0f7' : '#f0f4ff' }}>
        {hasCover ? (
          <>
            <img src={event.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.45))' }} />
            <div style={{ position: 'absolute', left: 14, right: 74, bottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dateStr}{location ? ` · ${location}` : ''}
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              if (canUploadCover) inputRef.current?.click()
            }}
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: '#b85aa0',
              cursor: canUploadCover ? 'pointer' : 'default',
            }}
          >
            {canUploadCover && (
              <span style={{ display: 'grid', placeItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
                <ImageIcon size={22} strokeWidth={1.6} color="#d07ab4" />
                Ajouter une photo de couverture
              </span>
            )}
          </button>
        )}
        {hasCover && (
          <div style={{
            position: 'absolute',
            top: 10,
            right: 10,
            minWidth: 54,
            height: 30,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.92)',
            color: '#e055aa',
            fontSize: 12,
            fontWeight: 900,
            display: 'grid',
            placeItems: 'center',
            padding: '0 10px',
          }}>
            {countdown.label}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />
      </div>

      <div style={{ padding: '12px 14px 14px', position: 'relative' }}>
        {!hasCover && (
          <>
            <div style={{
              position: 'absolute',
              top: 12,
              right: 14,
              minWidth: 54,
              height: 30,
              borderRadius: 999,
              background: '#fff',
              color: '#e055aa',
              fontSize: 12,
              fontWeight: 900,
              display: 'grid',
              placeItems: 'center',
              padding: '0 10px',
              border: '0.5px solid rgba(0,0,0,0.06)',
            }}>
              {countdown.label}
            </div>
            <div style={{ paddingRight: 66, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 500,
                marginTop: 4,
                background: TITLE_GRADIENT,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {dateStr}
              </div>
              {location && (
                <div style={{
                  fontSize: 12,
                  fontWeight: 500,
                  marginTop: 2,
                  background: TITLE_GRADIENT,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {location}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          <StatusChip status={event.myStatus} />
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
              background: TITLE_GRADIENT,
              minWidth: progress > 0 ? 10 : 0,
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AllEvents({ onBack, onEventClick }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true })
      if (!error) {
        const eventIds = (data ?? []).map(event => event.id).filter(Boolean)
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
              .select('id, name, first_name, avatar_url, email')
              .in('id', userIds)
            profilesById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
          }
        }

        setEvents((data ?? []).map(event => {
          const eventRsvps = rsvpRows.filter(row => row.event_id === event.id)
          const mine = eventRsvps.find(row => row.user_id === user?.id)
          const isOrganizer = event.user_id === user?.id
          return {
            ...event,
            isOrganizer,
            myStatus: isOrganizer ? 'going' : mine?.status,
            rsvpStats: countStatuses(eventRsvps),
            memberProfiles: eventRsvps.map(row => profilesById[row.user_id]).filter(Boolean),
          }
        }))
      }
      setLoading(false)
    }
    fetchAll()
  }, [])

  function handleCoverUploaded(eventId, coverImage) {
    setEvents(prev => prev.map(event => event.id === eventId ? { ...event, cover_image: coverImage } : event))
  }

  const upcoming = events.filter(e => !e.date || new Date(e.date) >= new Date())
  const past = events.filter(e => e.date && new Date(e.date) < new Date())

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#fff', padding: '10px 16px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#007AFF', marginRight: 4 }}>
            <ChevronLeft size={20} strokeWidth={1.5} color="#007AFF" />
            <span style={{ fontSize: 15, fontWeight: 500 }}>Retour</span>
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', letterSpacing: -0.4 }}>Tous mes événements</div>
        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{events.length} événement{events.length !== 1 ? 's' : ''}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, paddingTop: 40 }}>Chargement…</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, paddingTop: 40 }}>
            Aucun événement pour l'instant
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
                  À venir · {upcoming.length}
                </div>
                {upcoming.map(e => <EventCard key={e.id} event={e} onClick={onEventClick} onCoverUploaded={handleCoverUploaded} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', margin: '18px 0 10px' }}>
                  Passés · {past.length}
                </div>
                {past.map(e => (
                  <div key={e.id} style={{ opacity: 0.6 }}>
                    <EventCard event={e} onClick={onEventClick} onCoverUploaded={handleCoverUploaded} />
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
