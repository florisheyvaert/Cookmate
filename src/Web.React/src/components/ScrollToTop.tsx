import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * Resets the scroll to the top on a forward navigation, while leaving back/forward
 * (POP) to the browser's own scroll restoration — so returning to a page keeps you
 * where you were, but opening a new one starts at the top. In-page anchors (#hash)
 * are left alone so they can scroll to their target.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP' || hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash, navigationType])

  return null
}
