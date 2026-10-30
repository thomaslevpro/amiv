import { forwardRef, useLayoutEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Send } from 'lucide-react'
import { BG, BLACK, FONT, GRADIENT, WHITE } from './constants'

const LINE_HEIGHT = 20
const PADDING_Y = 10
const MAX_LINES = 5
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES + PADDING_Y * 2

// Ordinateur : Entrée envoie, Maj + Entrée va à la ligne. Téléphone (app ou
// navigateur) : la touche « retour » va à la ligne, on envoie avec le bouton.
export function enterSends() {
  if (Capacitor.isNativePlatform()) return false
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return !window.matchMedia('(pointer: coarse)').matches
}

export function canSend(text) {
  return !!text?.trim()
}

// Champ de saisie qui s'agrandit avec le texte jusqu'à 5 lignes, puis défile.
const MessageComposer = forwardRef(function MessageComposer({ value, onChange, onSend, paddingX = 16, buttonSize = 32, iconSize = 14 }, forwardedRef) {
  const localRef = useRef(null)
  const sendable = canSend(value)

  function setRef(node) {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  useLayoutEffect(() => {
    const el = localRef.current
    if (!el) return
    el.style.height = 'auto'
    const height = Math.min(el.scrollHeight, MAX_HEIGHT)
    el.style.height = `${height}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [value])

  const desktop = enterSends()

  return (
    <>
      <textarea
        ref={setRef}
        rows={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || !desktop) return
          e.preventDefault()
          onSend()
        }}
        enterKeyHint={desktop ? 'send' : 'enter'}
        placeholder="Message..."
        aria-label="Message"
        style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: `${PADDING_Y}px ${paddingX}px`, borderRadius: 20, background: BG, fontSize: 14, lineHeight: `${LINE_HEIGHT}px`, color: BLACK, border: 'none', outline: 'none', fontFamily: FONT, resize: 'none', overflowY: 'hidden', display: 'block', margin: 0 }}
      />
      <button
        type="button"
        aria-label="Envoyer"
        disabled={!sendable}
        // Empêche le bouton de voler le focus au champ (sinon le clavier se ferme)
        onPointerDown={e => e.preventDefault()}
        onMouseDown={e => e.preventDefault()}
        onClick={onSend}
        style={{ width: buttonSize, height: buttonSize, marginBottom: (LINE_HEIGHT + PADDING_Y * 2 - buttonSize) / 2, background: sendable ? GRADIENT : '#D1D1D6', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sendable ? 'pointer' : 'default', transition: 'background 0.15s', flexShrink: 0, padding: 0 }}
      >
        <Send size={iconSize} color={WHITE} fill={WHITE} strokeWidth={2.2} />
      </button>
    </>
  )
})

export default MessageComposer
