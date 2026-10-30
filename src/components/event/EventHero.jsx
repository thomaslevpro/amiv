import { ChevronLeft, MoreHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const visibilityLabel = {
  private: 'Privé',
  invite_only: 'Sur invitation',
  public: 'Public',
}

// Jours restants avant l'événement (null s'il est passé ou sans date)
export function countdownDays(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((day - today) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : null
}

const pillStyle = { display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 17, fontSize: 13, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', flexShrink: 0 }

// Photo de couverture (ou dégradé Amiv) : retour, J-X, menu « ··· » des
// organisateurs, et en bas le titre et « Type · Visibilité ».
export default function EventHero({ event, eventOverrides, onBack, onMenu }) {
  const displayName = eventOverrides.name ?? event.name
  const displayDate = eventOverrides.date ?? event.date
  // La base stocke souvent le libellé lui-même (« Privé 🔒 ») : sans l'emoji
  const visibility = (visibilityLabel[event.visibility] ?? event.visibility ?? 'Sur invitation').replace(/[^\p{L}\p{N}\s'-]/gu, '').trim()
  const countdown = event.__isPollActive ? null : countdownDays(displayDate)
  const rawCoverImage = eventOverrides.cover_image !== undefined ? eventOverrides.cover_image : event.cover_image
  const coverUrl = rawCoverImage
    ? rawCoverImage.startsWith('http') || rawCoverImage.startsWith('/')
      ? rawCoverImage
      : supabase.storage.from('event-covers').getPublicUrl(rawCoverImage).data.publicUrl
    : null

  return (
    <div style={{ position: 'relative', height: coverUrl ? 300 : 250, flexShrink: 0, overflow: 'hidden', background: coverUrl ? '#1C1C1E' : 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)' }}>
      {coverUrl && <img src={coverUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />}
      {/* Voile sombre en haut (boutons) et en bas (titre) pour la lisibilité */}
      <div style={{ position: 'absolute', inset: 0, background: coverUrl ? 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)' : 'linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.18) 100%)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, zIndex: 2 }}>
        <button type="button" onClick={onBack} style={pillStyle}>
          <ChevronLeft size={16} strokeWidth={2} color="white" />
          Retour
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {countdown !== null && (
            <div style={{ ...pillStyle, cursor: 'default', background: 'rgba(255,255,255,0.95)', color: '#e055aa', fontWeight: 800 }}>
              {countdown === 0 ? "Aujourd'hui" : `J-${countdown}`}
            </div>
          )}
          {onMenu && (
            <button type="button" onClick={onMenu} aria-label="Plus d'actions" style={{ ...pillStyle, width: 34, padding: 0, justifyContent: 'center' }}>
              <MoreHorizontal size={20} strokeWidth={2.2} color="white" />
            </button>
          )}
        </div>
      </div>

      {/* 24 px de plus en bas : la feuille d'infos chevauche la photo */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 16px 40px', color: '#fff', zIndex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.15, textShadow: coverUrl ? '0 1px 8px rgba(0,0,0,0.25)' : 'none', overflowWrap: 'anywhere' }}>{displayName}</div>
        <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.9, marginTop: 4 }}>{[event.type, visibility].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
  )
}
