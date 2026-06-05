import { useState } from 'react'
import { ChevronLeft, Cake } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const typeEmoji = {
  'Anniversaire': <Cake size={20} strokeWidth={1.5} />,
  'Soirée': '🥂',
  'Repas': '🍽️',
  'Autre': '🎉',
}

const visibilityLabel = {
  private: 'Privé 🔒',
  invite_only: 'Sur invitation',
  public: 'Public 🌍',
}

function formatDateHero(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const cap = datePart.charAt(0).toUpperCase() + datePart.slice(1)
  return `${cap} · ${timePart}`
}

function countdownDays(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const diff = Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : null
}

const rsvpOptions = [
  { status: 'going', label: "✓ J'y serai !" },
  { status: 'pending', label: 'Peut-être' },
  { status: 'declined', label: 'Non' },
]

function rsvpLabel(status) {
  const normalizedStatus = status === 'maybe' ? 'pending' : status
  return rsvpOptions.find(option => option.status === normalizedStatus)?.label || "J'y serai"
}

export default function EventHero({ event, eventOverrides, canManage, rsvpStatus, loading, onBack, onEdit, onRsvp }) {
  const [showRsvpMenu, setShowRsvpMenu] = useState(false)
  const displayName = eventOverrides.name ?? event.name
  const displayDate = eventOverrides.date ?? event.date
  const isPollActive = event.__isPollActive
  const emoji = typeEmoji[event.type] ?? '🎉'
  const visibility = visibilityLabel[event.visibility] ?? event.visibility ?? 'Sur invitation'
  const heroDate = isPollActive ? null : formatDateHero(displayDate)
  const countdown = isPollActive ? null : countdownDays(displayDate)
  const rawCoverImage = eventOverrides.cover_image !== undefined ? eventOverrides.cover_image : event.cover_image
  const coverUrl = rawCoverImage
    ? rawCoverImage.startsWith('http') || rawCoverImage.startsWith('/')
      ? rawCoverImage
      : supabase.storage.from('event-covers').getPublicUrl(rawCoverImage).data.publicUrl
    : null
  const showRsvpButton = !canManage && countdown !== null && typeof onRsvp === 'function'

  function handleRsvpChoice(status) {
    if (loading) return
    onRsvp(status)
    setShowRsvpMenu(false)
  }

  return (
    <div style={{
      position: 'relative',
      height: coverUrl ? '38vh' : 'auto',
      minHeight: coverUrl ? 180 : 'auto',
      flexShrink: 0,
      overflow: 'visible',
      background: coverUrl ? '#000' : 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)',
      ...(coverUrl ? {} : { padding: '58px 20px 24px', textAlign: 'center', color: '#fff' }),
    }}>
      {coverUrl && <img src={coverUrl} alt="cover" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.85 }} />}
      {coverUrl && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.62) 100%)' }} />}

      <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <div onClick={onBack} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', backdropFilter: 'blur(6px)' }}>
          <ChevronLeft size={14} strokeWidth={1.5} color="white" />
          Retour
        </div>
        {canManage && (
          <div onClick={onEdit} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', backdropFilter: 'blur(6px)' }}>
            Modifier
          </div>
        )}
      </div>

      <div style={{
        position: coverUrl ? 'absolute' : 'relative',
        ...(coverUrl ? { bottom: 0, left: 0, right: 0, padding: '0 20px 20px', zIndex: 2 } : { paddingTop: 58, textAlign: 'center', color: '#fff' }),
        color: '#fff',
        textAlign: coverUrl ? 'left' : 'center',
      }}>
        {!coverUrl && <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>}
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: -0.3, lineHeight: 1.2 }}>{displayName}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: heroDate ? 10 : 0 }}>{event.type} · {visibility}</div>
        {heroDate && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: coverUrl ? 'flex-start' : 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', backdropFilter: 'blur(4px)' }}>
              {heroDate}
            </div>
            {countdown !== null && (
              <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, color: '#e055aa' }}>
                J-{countdown}
              </div>
            )}
            {showRsvpButton && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowRsvpMenu(prev => !prev)}
                  style={{ border: 'none', background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 800, color: '#1C1C1E', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.65 : 1, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', whiteSpace: 'nowrap' }}
                >
                  {rsvpLabel(rsvpStatus)}
                </button>
                {showRsvpMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 196, background: '#fff', borderRadius: 16, padding: 8, boxShadow: '0 14px 34px rgba(0,0,0,0.22)', zIndex: 1001 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#8E8E93', padding: '4px 8px 8px' }}>Votre réponse</div>
                    {rsvpOptions.map(option => {
                      const active = (rsvpStatus === 'maybe' ? 'pending' : rsvpStatus) === option.status
                      return (
                        <button key={option.status} type="button" disabled={loading} onClick={() => handleRsvpChoice(option.status)} style={{ width: '100%', minHeight: 40, border: 'none', borderRadius: active ? 14 : 12, padding: '10px 12px', background: active ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F5F5F5', color: active ? '#fff' : '#1C1C1E', fontSize: 13, fontWeight: 800, textAlign: 'left', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {option.status === 'declined' && <span style={{ fontSize: 18, lineHeight: 0.8, fontWeight: 500 }}>×</span>}
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
