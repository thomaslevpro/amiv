import { useRef, useCallback } from 'react'

export default function useLongPress(callback, delay = 500) {
  const timer = useRef(null)

  const start = useCallback(() => {
    timer.current = setTimeout(callback, delay)
  }, [callback, delay])

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchEnd: cancel,
    onTouchMove: cancel,
  }
}
