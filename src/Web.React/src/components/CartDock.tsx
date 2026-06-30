import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useAnimate, useAnimationControls } from 'motion/react'
import { cartApi, type CartLine } from '@/api/shoppingCart'
import { useCartSort, groupByCategory, sortAZ } from '@/lib/cartSort'
import { CartSortToggle } from '@/components/CartSortToggle'

const ease = [0.22, 1, 0.36, 1] as const
const CART_KEY = ['shopping-cart']

/** What a parent triggers to animate a product flying into the cart button. */
export type CartDockHandle = {
  fly: (origin: DOMRect, imageUrl: string | null) => void
}

type Flyer = { id: number; from: DOMRect; imageUrl: string | null }

/**
 * The floating cart for the promo browser: an always-present button that shows a live count,
 * opens an inline bottom-sheet of the cart (remove + sort there), and links out to the full
 * cart page. Exposes `fly()` so a card can throw its image into the button on add.
 */
export const CartDock = forwardRef<CartDockHandle>(function CartDock(_props, ref) {
  const qc = useQueryClient()
  const cartQ = useQuery({ queryKey: CART_KEY, queryFn: () => cartApi.get() })
  const items = cartQ.data?.items ?? []
  const count = items.reduce((n, i) => n + i.quantity, 0)

  const [open, setOpen] = useState(false)
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const flyId = useRef(0)
  const fabRef = useRef<HTMLButtonElement>(null)
  const badge = useAnimationControls()

  useImperativeHandle(ref, () => ({
    fly: (origin, imageUrl) => {
      setFlyers((f) => [...f, { id: ++flyId.current, from: origin, imageUrl }])
    },
  }))

  function onFlyerDone(id: number) {
    setFlyers((f) => f.filter((x) => x.id !== id))
    badge.start({ scale: [1, 1.35, 1] }, { duration: 0.42, ease })
  }

  return (
    <>
      {/* ── Fly-to-cart layer ─────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
        {flyers.map((fl) => (
          <Flyer key={fl.id} flyer={fl} targetRef={fabRef} onDone={() => onFlyerDone(fl.id)} />
        ))}
      </div>

      {/* ── Floating cart button ──────────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
        <motion.button
          ref={fabRef}
          type="button"
          onClick={() => setOpen(true)}
          animate={badge}
          whileTap={{ scale: 0.92 }}
          aria-label={`Open cart — ${count} item${count === 1 ? '' : 's'}`}
          className="relative grid h-14 w-14 place-items-center rounded-full bg-paprika text-cream shadow-[0_10px_30px_-8px_rgba(232,90,26,0.7)] hover:bg-paprika-deep transition-colors"
        >
          <CartGlyph />
          <AnimatePresence>
            {count > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="absolute -top-1 -right-1 min-w-[1.35rem] h-[1.35rem] px-1 grid place-items-center rounded-full bg-ink text-cream num text-[0.72rem] leading-none ring-2 ring-cream"
              >
                {count}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* ── Inline cart drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && <CartSheet items={items} loading={cartQ.isPending} onClose={() => setOpen(false)} invalidate={() => qc.invalidateQueries({ queryKey: CART_KEY })} />}
      </AnimatePresence>
    </>
  )
})

function Flyer({
  flyer,
  targetRef,
  onDone,
}: {
  flyer: Flyer
  targetRef: RefObject<HTMLElement | null>
  onDone: () => void
}) {
  const { from, imageUrl } = flyer
  const [scope, animate] = useAnimate()

  // Measure the destination and run the arc imperatively (refs are safe to read here, not in render).
  useEffect(() => {
    const dest = targetRef.current?.getBoundingClientRect()
    if (!dest || !scope.current) {
      onDone()
      return
    }
    const dx = dest.left + dest.width / 2 - (from.left + from.width / 2)
    const dy = dest.top + dest.height / 2 - (from.top + from.height / 2)
    const controls = animate(
      scope.current,
      { x: [0, dx, dx], y: [0, dy * 0.4 - 70, dy], scale: [1, 0.7, 0.18], opacity: [1, 1, 0.4] },
      { duration: 0.66, ease: [0.45, 0, 0.25, 1], times: [0, 0.55, 1] },
    )
    controls.then(onDone)
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={scope}
      style={{ position: 'fixed', left: from.left, top: from.top, width: from.width, height: from.height }}
      className="overflow-hidden rounded-2xl bg-cream-deep border border-cream-shadow shadow-lg"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-2xl" aria-hidden>🛒</span>
      )}
    </div>
  )
}

function CartSheet({
  items,
  loading,
  onClose,
  invalidate,
}: {
  items: CartLine[]
  loading: boolean
  onClose: () => void
  invalidate: () => void
}) {
  const [mode, setMode] = useCartSort()
  const setQty = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) => cartApi.setQuantity(id, quantity),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: number) => cartApi.remove(id), onSuccess: invalidate })
  const busy = setQty.isPending || remove.isPending

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const count = items.reduce((n, i) => n + i.quantity, 0)
  const groups = mode === 'category' ? groupByCategory(items) : [{ category: '', items: sortAZ(items) }]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[82vh] flex flex-col bg-cream rounded-t-3xl border-t border-cream-shadow overflow-hidden shadow-2xl shadow-ink/30"
      >
        {/* Grab handle */}
        <div className="shrink-0 pt-2.5 pb-1 grid place-items-center" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-cream-shadow" />
        </div>

        <header className="shrink-0 flex items-center justify-between gap-3 px-5 pb-3.5 pt-1.5 border-b border-cream-shadow">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              Your cart
            </h2>
            <span className="num text-chestnut-soft text-sm">{count}</span>
          </div>
          {items.length > 0 && <CartSortToggle mode={mode} onChange={setMode} size="sm" />}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="eyebrow text-chestnut">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-ink-soft leading-relaxed py-6" style={{ fontFamily: 'var(--font-body)' }}>
              Your cart is empty. Add something from the bonus and it lands here.
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.category || 'all'}>
                  {mode === 'category' && (
                    <div className="flex items-baseline gap-2.5 mb-2">
                      <h3 className="eyebrow text-ink">{g.category}</h3>
                      <span className="flex-1 h-px bg-cream-shadow" />
                    </div>
                  )}
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {g.items.map((line) => (
                        <SheetRow
                          key={line.id}
                          line={line}
                          busy={busy}
                          onInc={() => setQty.mutate({ id: line.id, quantity: line.quantity + 1 })}
                          onDec={() => setQty.mutate({ id: line.id, quantity: line.quantity - 1 })}
                          onRemove={() => remove.mutate(line.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="shrink-0 px-5 py-3.5 border-t border-cream-shadow flex items-center justify-between gap-3">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-chestnut-soft">
            {items.length} line{items.length === 1 ? '' : 's'}
          </span>
          <Link
            to="/shopping-cart"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 bg-paprika text-cream font-display font-semibold text-[0.85rem] hover:bg-paprika-deep transition-colors no-underline"
          >
            Open full cart <span aria-hidden>→</span>
          </Link>
        </footer>
      </motion.div>
    </motion.div>
  )
}

function SheetRow({
  line,
  busy,
  onInc,
  onDec,
  onRemove,
}: {
  line: CartLine
  busy: boolean
  onInc: () => void
  onDec: () => void
  onRemove: () => void
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2, ease }}
      className="flex items-center gap-3 rounded-xl border border-cream-shadow bg-cream-deep px-3 py-2.5"
    >
      <span className="shrink-0 w-11 h-11 rounded-lg overflow-hidden border border-cream-shadow bg-cream grid place-items-center">
        {line.imageUrl ? (
          <img src={line.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span aria-hidden className="text-base opacity-40">{line.isLinked ? '🛒' : '✎'}</span>
        )}
      </span>
      <p className="min-w-0 flex-1 font-display text-ink leading-tight line-clamp-2" style={{ fontWeight: 600, fontSize: '0.92rem' }}>
        {line.displayName}
      </p>
      <div className="shrink-0 flex items-center gap-1">
        <button type="button" onClick={onDec} disabled={busy} aria-label="Less" className={stepBtn}>−</button>
        <span className="num text-sm text-ink w-5 text-center tabular-nums">{line.quantity}</span>
        <button type="button" onClick={onInc} disabled={busy} aria-label="More" className={stepBtn}>+</button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label="Remove"
        className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-chestnut-soft hover:text-red-600 hover:bg-red-500/10 transition-colors"
      >
        <span aria-hidden className="text-base leading-none">×</span>
      </button>
    </motion.li>
  )
}

const stepBtn =
  'w-7 h-7 grid place-items-center rounded-lg border border-cream-shadow text-ink hover:border-paprika hover:text-paprika disabled:opacity-40 transition-colors text-base leading-none'

function CartGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2.2l2.3 12.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L21.5 7H6" />
    </svg>
  )
}
