import { Lock, MoreHorizontal } from 'lucide-react'
import { COLORS } from './ui'

// Carte de la grille Flashback. Toutes les cartes ont la même taille : zone
// visuelle 4:3 (image en cover, sinon couleur + emoji), puis un pied de
// hauteur fixe avec avatar, prénom et légende sur 2 lignes au plus.
// Les souvenirs des autres (memory.hidden) arrivent sans contenu : seuls
// l'auteur et la date sont connus. onMenu (ses propres souvenirs, avant la
// révélation) ajoute le bouton ··· des actions.
const FOOTER_HEIGHT = 70

export default function MemoryCard({ memory, author, palette, avatarColor, highlighted, onMenu }) {
  const hidden = !!memory.hidden
  const caption = hidden ? 'a ajouté un souvenir 🎁' : memory.text

  return (
    <article
      id={`secret-item-${memory.id}`}
      aria-label={hidden ? `${author} a ajouté un souvenir` : undefined}
      style={{ background: COLORS.card, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: highlighted ? 'secretHighlight 2.4s ease-out' : undefined }}
    >
      <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: hidden ? '#EDEDF2' : palette.bg }}>
        {hidden ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 40%, rgba(175,169,236,0.35), rgba(175,169,236,0) 70%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1 }}>🎁</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: COLORS.muted }}>
                <Lock size={10} strokeWidth={2.6} />
                Caché jusqu’à la révélation
              </span>
            </div>
          </div>
        ) : memory.display_image_url ? (
          <>
            <img src={memory.display_image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {memory.emoji && (
              <span aria-hidden="true" style={{ position: 'absolute', top: 6, left: 6, width: 28, height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center', fontSize: 15, lineHeight: 1 }}>
                {memory.emoji}
              </span>
            )}
          </>
        ) : (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 40, lineHeight: 1 }}>
            {memory.emoji || '✨'}
          </div>
        )}
        {onMenu && (
          <button type="button" onClick={() => onMenu(memory)} aria-label="Actions du souvenir" style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, background: 'rgba(28,28,30,0.55)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <MoreHorizontal size={18} strokeWidth={2.4} color="#fff" />
          </button>
        )}
      </div>

      <div style={{ height: FOOTER_HEIGHT, boxSizing: 'border-box', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {memory.profile?.avatar_url ? (
            <img src={memory.profile.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: 11, background: avatarColor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
              {author.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0, fontSize: 12, fontWeight: 600, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {author}
          </div>
        </div>
        {caption && (
          <p style={{ margin: 0, fontSize: 11, lineHeight: '14px', color: COLORS.muted, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
            {caption}
          </p>
        )}
      </div>
    </article>
  )
}
