import { useRef } from 'react'
import { hapticLight, hapticMedium } from '../lib/haptics'

const LONG_PRESS_MS = 400
const DOUBLE_TAP_MS = 300
// Au-delà, le doigt fait défiler la liste : ni appui long ni tap
const MOVE_TOLERANCE_PX = 10

// Gestes sur une bulle : appui long = onLongPress(msg, élément), double-tap =
// onDoubleTap(msg), tap seul = rien. bubbleHandlers(msg) s'étale sur la bulle.
export function useMessageGestures({ onLongPress, onDoubleTap }) {
  const gestureRef = useRef(null)
  const lastTapRef = useRef({ id: null, at: 0 })

  function clearGesture() {
    if (gestureRef.current?.timer) clearTimeout(gestureRef.current.timer)
    gestureRef.current = null
  }

  function bubbleHandlers(msg, enabled = true) {
    if (!enabled) {
      return { onContextMenu: event => event.preventDefault() }
    }
    return {
      onPointerDown(event) {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        clearGesture()
        const element = event.currentTarget
        const gesture = { id: msg.id, x: event.clientX, y: event.clientY, fired: false }
        gesture.timer = setTimeout(() => {
          gesture.fired = true
          lastTapRef.current = { id: null, at: 0 }
          hapticMedium()
          onLongPress(msg, element)
        }, LONG_PRESS_MS)
        gestureRef.current = gesture
      },
      onPointerMove(event) {
        const gesture = gestureRef.current
        if (!gesture || gesture.fired) return
        if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > MOVE_TOLERANCE_PX) clearGesture()
      },
      onPointerUp() {
        const gesture = gestureRef.current
        clearGesture()
        if (!gesture || gesture.fired || gesture.id !== msg.id) return
        const now = Date.now()
        if (lastTapRef.current.id === msg.id && now - lastTapRef.current.at < DOUBLE_TAP_MS) {
          lastTapRef.current = { id: null, at: 0 }
          hapticLight()
          onDoubleTap(msg)
        } else {
          lastTapRef.current = { id: msg.id, at: now }
        }
      },
      onPointerCancel: clearGesture,
      onPointerLeave: clearGesture,
      // Clic droit (ordinateur) ou appui long Android : même menu, jamais celui du système
      onContextMenu(event) {
        event.preventDefault()
        if (gestureRef.current?.fired) return
        clearGesture()
        onLongPress(msg, event.currentTarget)
      },
    }
  }

  return { bubbleHandlers }
}
