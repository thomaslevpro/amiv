import { useEffect, useRef, useState } from 'react'
import { Copy, Flag, Reply, Trash2 } from 'lucide-react'
import { BLACK, FONT, GRADIENT, WHITE } from './constants'

export const REACTION_EMOJIS = ['❤️', '😂', '🎉', '👍', '😮', '😢']

const DESTRUCTIVE = '#FF3B30'
const BAR_HEIGHT = 52
const BAR_WIDTH = REACTION_EMOJIS.length * 42 + 12
const MENU_WIDTH = 230
const MENU_ROW_HEIGHT = 46
const GAP = 10
const EDGE = 12
// Marges hautes / basses : barre d'état et zone du geste d'accueil iPhone
const TOP_MARGIN = 56
const BOTTOM_MARGIN = 34

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // WebView sans API presse-papiers : ancienne méthode
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand?.('copy') === true
    field.remove()
    return ok
  }
}

// Place la bulle là où elle était, en la décalant juste assez pour que la
// barre de réactions (au-dessus) et le menu (en dessous) tiennent à l'écran.
function layout(rect, menuRows, isMine) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const menuHeight = menuRows * MENU_ROW_HEIGHT
  const maxBubbleHeight = Math.max(60, vh - TOP_MARGIN - BOTTOM_MARGIN - BAR_HEIGHT - menuHeight - GAP * 2)
  const bubbleHeight = Math.min(rect.height, maxBubbleHeight)
  const minTop = TOP_MARGIN + BAR_HEIGHT + GAP
  const maxTop = vh - BOTTOM_MARGIN - menuHeight - GAP - bubbleHeight
  const top = Math.max(minTop, Math.min(rect.top, maxTop))
  const side = isMine
    ? { bubble: { right: vw - rect.right }, bar: { right: Math.max(EDGE, Math.min(vw - rect.right, vw - EDGE - BAR_WIDTH)) }, menu: { right: Math.max(EDGE, Math.min(vw - rect.right, vw - EDGE - MENU_WIDTH)) } }
    : { bubble: { left: rect.left }, bar: { left: Math.max(EDGE, Math.min(rect.left, vw - EDGE - BAR_WIDTH)) }, menu: { left: Math.max(EDGE, Math.min(rect.left, vw - EDGE - MENU_WIDTH)) } }
  return { top, bubbleHeight, maxBubbleHeight, shift: rect.top - top, side }
}

// Appui long sur un message : bulle mise en avant sur fond flouté, réactions
// au-dessus, actions en dessous. Le contenu de la bulle est passé en children.
export default function MessageActionOverlay({
  rect,
  isMine,
  myEmojis,
  onReact,
  onReply,
  onCopy,
  onReport,
  onDelete,
  onClose,
  children,
}) {
  const [entered, setEntered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Le doigt qui a ouvert l'overlay se relève dessus : ce « clic » ne doit pas le refermer
  const pressedBackdropRef = useRef(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    const handleKey = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const actions = [
    { key: 'reply', label: 'Répondre', icon: Reply, onClick: onReply },
    { key: 'copy', label: 'Copier', icon: Copy, onClick: onCopy },
    isMine
      ? { key: 'delete', label: confirmDelete ? 'Supprimer pour tous ?' : 'Supprimer', icon: Trash2, destructive: true, onClick: () => (confirmDelete ? onDelete() : setConfirmDelete(true)) }
      : { key: 'report', label: 'Signaler', icon: Flag, destructive: true, onClick: onReport },
  ]
  const { top, bubbleHeight, maxBubbleHeight, shift, side } = layout(rect, actions.length, isMine)
  const motion = {
    transition: 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.16s ease',
    transformOrigin: isMine ? 'right center' : 'left center',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Actions sur le message"
      onPointerDown={event => { pressedBackdropRef.current = event.target === event.currentTarget }}
      onClick={event => {
        if (event.target === event.currentTarget && pressedBackdropRef.current) onClose()
        pressedBackdropRef.current = false
      }}
      onContextMenu={event => event.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 950,
        background: entered ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0)',
        backdropFilter: entered ? 'blur(14px)' : 'blur(0px)',
        WebkitBackdropFilter: entered ? 'blur(14px)' : 'blur(0px)',
        transition: 'background 0.18s ease, backdrop-filter 0.18s ease, -webkit-backdrop-filter 0.18s ease',
        fontFamily: FONT,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <div
        role="toolbar"
        aria-label="Réactions"
        style={{
          position: 'absolute',
          top: top - GAP - BAR_HEIGHT,
          ...side.bar,
          height: BAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '0 6px',
          boxSizing: 'border-box',
          borderRadius: BAR_HEIGHT / 2,
          background: WHITE,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1)' : 'scale(0.6) translateY(12px)',
          ...motion,
        }}
      >
        {REACTION_EMOJIS.map(emoji => {
          const mine = myEmojis.has(emoji)
          return (
            <button
              key={emoji}
              type="button"
              aria-label={`Réagir avec ${emoji}`}
              aria-pressed={mine}
              onClick={() => onReact(emoji)}
              style={{
                width: 40,
                height: 40,
                border: 'none',
                borderRadius: '50%',
                background: mine ? `linear-gradient(${WHITE}, ${WHITE}) padding-box, ${GRADIENT} border-box` : 'transparent',
                borderStyle: 'solid',
                borderWidth: mine ? 2 : 0,
                borderColor: 'transparent',
                boxSizing: 'border-box',
                fontSize: 24,
                lineHeight: 1,
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {emoji}
            </button>
          )
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          top,
          ...side.bubble,
          width: rect.width,
          maxHeight: maxBubbleHeight,
          height: bubbleHeight,
          overflow: 'hidden',
          borderRadius: 18,
          pointerEvents: 'none',
          transform: entered ? 'translateY(0) scale(1.03)' : `translateY(${shift}px) scale(1)`,
          transition: 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
          transformOrigin: isMine ? 'right center' : 'left center',
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.18))',
        }}
      >
        {children}
      </div>

      <div
        role="menu"
        style={{
          position: 'absolute',
          top: top + bubbleHeight + GAP,
          ...side.menu,
          width: MENU_WIDTH,
          borderRadius: 14,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.96)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          opacity: entered ? 1 : 0,
          transform: entered ? 'scale(1)' : 'scale(0.6) translateY(-12px)',
          ...motion,
        }}
      >
        {actions.map(({ key, label, icon: Icon, destructive, onClick }, index) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            onClick={onClick}
            style={{
              width: '100%',
              height: MENU_ROW_HEIGHT,
              border: 'none',
              borderTop: index ? '0.5px solid rgba(0,0,0,0.1)' : 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 16px',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: FONT,
              color: destructive ? DESTRUCTIVE : BLACK,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {label}
            <Icon size={18} strokeWidth={1.9} color={destructive ? DESTRUCTIVE : BLACK} />
          </button>
        ))}
      </div>
    </div>
  )
}
