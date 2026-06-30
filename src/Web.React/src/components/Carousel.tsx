import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A horizontal, snap-scrolling row. Children set their own widths (e.g.
 * `shrink-0 snap-start basis-[46%]`) so a couple peek at the edge. Hover arrows
 * appear on pointer devices; touch just swipes. When `hasMore` is set, scrolling
 * near the right edge calls `onLoadMore` for scroll-to-load.
 */
export function Carousel({
  children,
  hasMore = false,
  onLoadMore,
  ariaLabel,
}: {
  children: ReactNode
  hasMore?: boolean
  onLoadMore?: () => void
  ariaLabel?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  // Latest load-more intent, read inside a one-time observer so inline callbacks stay fine.
  const more = useRef({ hasMore, onLoadMore })
  useEffect(() => {
    more.current = { hasMore, onLoadMore }
  })

  useEffect(() => {
    const root = scroller.current
    const el = sentinel.current
    if (!root || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && more.current.hasMore) more.current.onLoadMore?.()
      },
      { root, rootMargin: '0px 600px 0px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const page = (dir: number) => {
    const root = scroller.current
    if (root) root.scrollBy({ left: dir * root.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className="relative group/carousel">
      <div
        ref={scroller}
        aria-label={ariaLabel}
        className="flex gap-3.5 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <div ref={sentinel} aria-hidden className="shrink-0 w-px" />
      </div>

      <Arrow dir={-1} onClick={() => page(-1)} />
      <Arrow dir={1} onClick={() => page(1)} />
    </div>
  )
}

function Arrow({ dir, onClick }: { dir: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir < 0 ? 'Scroll left' : 'Scroll right'}
      className={[
        'hidden sm:grid place-items-center absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full',
        'bg-cream/95 backdrop-blur border border-cream-shadow text-chestnut shadow-md',
        'hover:border-paprika hover:text-paprika transition-all',
        'opacity-0 group-hover/carousel:opacity-100',
        dir < 0 ? 'left-1' : 'right-1',
      ].join(' ')}
    >
      <span aria-hidden className="text-lg leading-none">{dir < 0 ? '‹' : '›'}</span>
    </button>
  )
}
