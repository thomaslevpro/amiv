import { X } from 'lucide-react'
import { BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'

const ACCENT = '#e055aa'

// Pas de sélection de texte ni de menu iOS sur une bulle : l'appui long ouvre
// notre menu (MessageActionOverlay)
export const NO_NATIVE_PRESS = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  touchAction: 'manipulation',
}

function ReactionPill({ reaction, onClick }) {
  const mine = reaction.reactedByMe
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${reaction.emoji} ${reaction.count}${mine ? ', retirer ma réaction' : ', réagir aussi'}`}
      aria-pressed={mine}
      style={{
        border: mine ? 'none' : '1px solid rgba(0,0,0,0.06)',
        background: mine ? GRADIENT : WHITE,
        color: mine ? WHITE : BLACK,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        borderRadius: 14,
        padding: mine ? '3px 8px' : '2px 7px',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 12,
        lineHeight: 1.2,
        cursor: 'pointer',
        fontFamily: FONT,
        touchAction: 'manipulation',
      }}
    >
      <span>{reaction.emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{reaction.count}</span>
    </button>
  )
}

// Pastilles sous une bulle, groupées par emoji ; ma réaction en dégradé
export function ReactionPills({ reactions, isMine, onToggle }) {
  if (!reactions?.length) return null
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: isMine ? 'flex-end' : 'flex-start',
      gap: 4,
      marginTop: 4,
      paddingLeft: isMine ? 0 : 4,
      paddingRight: isMine ? 4 : 0,
    }}>
      {reactions.map(reaction => (
        <ReactionPill key={reaction.emoji} reaction={reaction} onClick={() => onToggle(reaction.emoji)} />
      ))}
    </div>
  )
}

// Citation du message auquel on répond, en haut de la bulle
export function ReplyQuote({ quotedName, content, isMine }) {
  return (
    <div style={{
      margin: '-2px -6px 6px',
      padding: '5px 9px',
      borderRadius: 11,
      borderLeft: `3px solid ${isMine ? 'rgba(255,255,255,0.75)' : ACCENT}`,
      background: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
      fontSize: 13,
      lineHeight: 1.3,
      whiteSpace: 'normal',
      fontStyle: 'normal',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 1 }}>{quotedName}</div>
      <div style={{ opacity: 0.85, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {content}
      </div>
    </div>
  )
}

// Au-dessus de la saisie : « Réponse à … » avec le message cité
export function ReplyBar({ label, content, onCancel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 0 16px' }}>
      <div style={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${ACCENT}`, paddingLeft: 9 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{label}</div>
        <div style={{ fontSize: 13, color: GRAY1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {content}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Annuler la réponse"
        style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#E5E5EA', color: BLACK, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', flexShrink: 0 }}
      >
        <X size={15} strokeWidth={2.2} />
      </button>
    </div>
  )
}
