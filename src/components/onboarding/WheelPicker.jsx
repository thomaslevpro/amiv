import { useEffect, useLayoutEffect, useRef } from 'react'
import { hapticLight } from '../../lib/haptics'
import { BLACK, FONT } from './OnboardingUI'

const ITEM_HEIGHT = 40
const VISIBLE = 5
const PAD = ((VISIBLE - 1) / 2) * ITEM_HEIGHT

// Roue de sélection (défilement aimanté). options : [{ value, label }]
export function WheelColumn({ options, value, onChange, label, flex = 1 }) {
  const ref = useRef(null)
  const lastIndex = useRef(-1)
  const settleTimer = useRef(null)
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))

  // Position initiale, et recalage si la valeur change de l'extérieur
  // (ex. 31 → 30 en passant à un mois de 30 jours)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const target = selectedIndex * ITEM_HEIGHT
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target
    lastIndex.current = selectedIndex
  }, [selectedIndex, options.length])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const index = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)))
    if (index !== lastIndex.current) {
      lastIndex.current = index
      hapticLight()
    }
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      if (options[index] && options[index].value !== value) onChange(options[index].value)
    }, 90)
  }

  // Appui sur une valeur (même celle déjà au centre : elle compte comme choisie)
  const select = index => {
    ref.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
    onChange(options[index].value)
  }

  const handleKeyDown = event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const next = Math.min(options.length - 1, Math.max(0, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)))
    onChange(options[next].value)
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${label}-${selectedIndex}`}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      style={{
        flex,
        height: VISIBLE * ITEM_HEIGHT,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        position: 'relative',
        zIndex: 1,
        outline: 'none',
        scrollbarWidth: 'none',
        maskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
      }}
    >
      <div style={{ height: PAD }} />
      {options.map((option, index) => (
        <div
          key={option.value ?? 'none'}
          id={`${label}-${index}`}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => select(index)}
          style={{
            height: ITEM_HEIGHT,
            scrollSnapAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: index === selectedIndex ? 21 : 19,
            fontWeight: index === selectedIndex ? 650 : 400,
            color: index === selectedIndex ? BLACK : '#8E8E93',
            fontFamily: FONT,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'font-size 0.15s ease, color 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {option.label}
        </div>
      ))}
      <div style={{ height: PAD }} />
    </div>
  )
}

// Plusieurs colonnes côte à côte, bande de sélection commune au centre
export default function WheelPicker({ children }) {
  return (
    <div style={{ position: 'relative', display: 'flex', gap: 4, background: '#FAFAFA', borderRadius: 22, padding: '0 8px' }}>
      <div style={{ position: 'absolute', left: 8, right: 8, top: PAD, height: ITEM_HEIGHT, borderRadius: 12, background: '#EFEFF4', pointerEvents: 'none' }} />
      {children}
    </div>
  )
}
