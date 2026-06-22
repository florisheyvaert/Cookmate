import { useRef } from 'react'

type SwipeHandlers = {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

/**
 * Horizontal swipe detection for touch devices. Fires `onLeft` on a swipe to the
 * left (→ next) and `onRight` on a swipe to the right (← previous). Ignores
 * mostly-vertical gestures so it never hijacks the page scroll.
 */
export function useSwipe(onLeft: () => void, onRight: () => void, threshold = 45): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart: (e) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      // Need a clear horizontal intent: past the threshold and more sideways than vertical.
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return
      if (dx < 0) onLeft()
      else onRight()
    },
  }
}
