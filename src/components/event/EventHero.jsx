import { ChevronLeft, Image as ImageIcon, Cake } from 'lucide-react'
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

export default function EventHero({ event, eventOverrides, canManage, onBack, onEdit, onCoverChange, coverInputRef }) {
  const displayName = eventOverrides.name ?? event.name
  const displayDate = eventOverrides.date ?? event.date
  const isPollActive = event.__isPollActive
  const emoji = typeEmoji[event.type] ?? '🎉'
  const visibility = visibilityLabel[event.visibility] ?? event.visibility ?? 'Sur invitation'
  const heroDate = isPollActive ? null : formatDateHero(displayDate)
  const countdown = isPollActive ? null : countdownDays(displayDate)
  const rawCoverImage = eventOverrides.cover_image !== undefined ? eventOverrides.cover_image : event.cover_image
  const coverUrl = rawCoverImage
    ? supabase.storage.from('event-covers').getPublicUrl(rawCoverImage).data.publicUrl
    : null

  return (
    <div style={{
      position: 'relative',
      height: coverUrl ? '38vh' : 'auto',
      minHeight: coverUrl ? 180 : 'auto',
      flexShrink: 0,
      overflow: 'hidden',
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
          <div onClick={onEdit} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff', backdropFilter: 'blur(6px)', marginRight: 44 }}>
            Modifier ✏️
          </div>
        )}
      </div>

      {canManage && (
        <>
          <button type="button" aria-label="Changer la photo de couverture" onClick={() => coverInputRef.current?.click()} style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', color: '#1C1C1E', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.14)', display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 3 }}>
            <ImageIcon size={18} strokeWidth={1.8} />
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" onChange={onCoverChange} style={{ display: 'none' }} />
        </>
      )}

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
          </div>
        )}
      </div>
    </div>
  )
}
