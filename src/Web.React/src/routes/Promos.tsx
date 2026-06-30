import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { promotionsApi } from '@/api/promotions'
import type { PromoPeriod, PromotionDto } from '@/api/promotions'
import { cartApi } from '@/api/shoppingCart'
import { CartDock, type CartDockHandle } from '@/components/CartDock'

const STORE = 'ah'
const STORE_NAME = 'Albert Heijn'
const PAGE = 18 // promos revealed per scroll batch

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

const dayMonth = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' })
const dayOnly = new Intl.DateTimeFormat('nl-BE', { day: 'numeric' })

/** "22–28 jun" within one month, "29 jun–5 jul" across months. */
function formatWeek(from: string | null, to: string | null): string {
  if (!from) return 'Bonus'
  const f = new Date(`${from}T00:00:00`)
  if (!to) return dayMonth.format(f)
  const t = new Date(`${to}T00:00:00`)
  const sameMonth = f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()
  return sameMonth ? `${dayOnly.format(f)}–${dayMonth.format(t)}` : `${dayMonth.format(f)}–${dayMonth.format(t)}`
}

// Group an already category-ordered list into consecutive category sections.
function groupByCategory(list: PromotionDto[]): { category: string; items: PromotionDto[] }[] {
  const groups: { category: string; items: PromotionDto[] }[] = []
  for (const p of list) {
    const category = p.category ?? 'Overige'
    const last = groups[groups.length - 1]
    if (last && last.category === category) last.items.push(p)
    else groups.push({ category, items: [p] })
  }
  return groups
}

export default function Promos() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [drillGroup, setDrillGroup] = useState<PromotionDto | null>(null)
  const [added, setAdded] = useState<Set<string>>(() => new Set())
  const dock = useRef<CartDockHandle>(null)

  const periodsQ = useQuery({
    queryKey: ['promo-periods', STORE],
    queryFn: () => promotionsApi.periods(STORE),
    staleTime: 5 * 60_000,
  })

  const periods = periodsQ.data ?? []
  const currentWeek = periods.find((p) => p.isCurrent)?.validFrom ?? periods[0]?.validFrom ?? null
  const activeWeek = params.get('week') ?? currentWeek

  // We have some bonus weeks cached, but not the live one — the auto-refresh hasn't caught up.
  const showStaleBanner = periodsQ.isSuccess && periods.length > 0 && !periods.some((p) => p.isCurrent)

  const promosQ = useQuery({
    queryKey: ['promotions', STORE, activeWeek],
    queryFn: () => promotionsApi.list(STORE, activeWeek),
    staleTime: 5 * 60_000,
  })
  const promos = useMemo(() => promosQ.data ?? [], [promosQ.data])

  function pickWeek(validFrom: string | null) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (validFrom) p.set('week', validFrom)
        else p.delete('week')
        return p
      },
      { replace: true },
    )
  }

  const addToCart = useMutation({
    mutationFn: (item: { sku: string; name: string; imageUrl: string | null; category: string | null }) =>
      cartApi.add({ displayName: item.name, storeCode: STORE, sku: item.sku, imageUrl: item.imageUrl, category: item.category, source: 1 }),
    onSuccess: (_id, item) => {
      setAdded((prev) => new Set(prev).add(item.sku))
      qc.invalidateQueries({ queryKey: ['shopping-cart'] })
      qc.invalidateQueries({ queryKey: ['cart-dishes'] })
    },
  })

  // Add to cart and throw the product image into the floating cart button.
  function addPromo(promo: PromotionDto, origin: DOMRect | null) {
    if (origin) dock.current?.fly(origin, promo.imageUrl)
    addToCart.mutate({ sku: promo.sku, name: promo.name, imageUrl: promo.imageUrl, category: promo.category })
  }

  // Scroll-to-load: reveal the already-fetched week in batches. When the week changes, reset the
  // reveal count during render (the React-recommended way) rather than in an effect.
  const [visible, setVisible] = useState(PAGE)
  const [shownWeek, setShownWeek] = useState(activeWeek)
  if (shownWeek !== activeWeek) {
    setShownWeek(activeWeek)
    setVisible(PAGE)
  }
  const sentinel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => Math.min(v + PAGE, promos.length))
      },
      { rootMargin: '800px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [promos.length])

  const refresh = useMutation({
    mutationFn: () => promotionsApi.refresh(STORE),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-periods', STORE] })
      qc.invalidateQueries({ queryKey: ['promotions', STORE] })
    },
  })

  const shown = promos.slice(0, visible)
  const groups = useMemo(() => groupByCategory(shown), [shown])
  // Full per-category totals (the revealed slice may show only part of a category).
  const categoryTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of promos) {
      const c = p.category ?? 'Overige'
      m.set(c, (m.get(c) ?? 0) + 1)
    }
    return m
  }, [promos])

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 py-8 sm:py-12 pb-20">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="mb-8 sm:mb-10 max-w-xl">
        <p className="eyebrow text-paprika mb-2.5">{STORE_NAME} · Bonus folder</p>
        <h1
          className="font-display text-ink"
          style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', lineHeight: 0.98, fontWeight: 800, letterSpacing: '-0.035em' }}
        >
          Cook the{' '}
          <span className="italic" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-paprika)' }}>
            bonus
          </span>
          .
        </h1>
        <p className="mt-4 text-ink-soft text-lg leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
          Browse the bonus and add what you want to your cart. See what you can cook with it over on the cart.
        </p>
      </header>

      {/* This week's bonus hasn't been pulled yet — it refreshes itself weekly, but offer a nudge. */}
      {showStaleBanner && (
        <StaleWeekBanner isAdmin={isAdmin} onRefresh={() => refresh.mutate()} refreshing={refresh.isPending} />
      )}

      {/* ── Week filter ────────────────────────────────────────────────────── */}
      {periods.length > 0 && <WeekTabs periods={periods} active={activeWeek} onPick={pickWeek} />}

      {/* ── Promos ─────────────────────────────────────────────────────────── */}
      {promosQ.isPending ? (
        <p className="eyebrow text-chestnut">Loading promotions…</p>
      ) : promos.length === 0 ? (
        <EmptyPromos isAdmin={isAdmin} onRefresh={() => refresh.mutate()} refreshing={refresh.isPending} />
      ) : (
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-5">
            <h2 className="eyebrow text-ink">
              On promotion <span className="text-chestnut-soft">· {promos.length}</span>
            </h2>
          </div>

          {/* Grouped by category in the store's own order. Single column on mobile = an
              AH-style list; bigger photo cards from sm up. */}
          <div className="space-y-9 sm:space-y-12">
            {groups.map((g) => (
              <div key={g.category}>
                <div className="flex items-baseline gap-3 mb-4">
                  <h3
                    className="font-display text-ink"
                    style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.02em' }}
                  >
                    {g.category}
                  </h3>
                  <span className="num text-chestnut-soft text-xs">{categoryTotals.get(g.category) ?? g.items.length}</span>
                  <span className="flex-1 h-px bg-cream-shadow" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {g.items.map((p) => (
                    <PromoCard
                      key={p.sku}
                      promo={p}
                      added={added.has(p.sku)}
                      onAdd={(origin) => addPromo(p, origin)}
                      onDrill={() => setDrillGroup(p)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {visible < promos.length && <div ref={sentinel} aria-hidden className="h-12" />}
        </section>
      )}

      {/* ── Group drill-down ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {drillGroup && (
          <GroupDrillDown
            group={drillGroup}
            week={activeWeek}
            added={added}
            onAdd={(promo, origin) => addPromo(promo, origin)}
            onClose={() => setDrillGroup(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Floating cart (count badge, inline drawer, fly-to-cart target) ───── */}
      <CartDock ref={dock} />
    </div>
  )
}

function StaleWeekBanner({ isAdmin, onRefresh, refreshing }: { isAdmin: boolean; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-paprika/35 bg-paprika/8 px-4 sm:px-5 py-3.5">
      <p className="text-ink leading-snug" style={{ fontFamily: 'var(--font-body)' }}>
        <span aria-hidden className="mr-1.5">🛎️</span>
        This week's bonus isn't loaded yet
        {isAdmin ? '.' : ' — an admin can refresh it.'}
      </p>
      {isAdmin && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-paprika text-cream font-display font-semibold text-[0.85rem] hover:bg-paprika-deep transition-colors disabled:opacity-50"
        >
          <span aria-hidden className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      )}
    </div>
  )
}

function WeekTabs({
  periods,
  active,
  onPick,
}: {
  periods: PromoPeriod[]
  active: string | null
  onPick: (validFrom: string | null) => void
}) {
  return (
    <nav aria-label="Bonus week" className="flex flex-wrap gap-2.5 mb-10 sm:mb-12">
      {periods.map((p) => {
        const isActive = p.validFrom === active
        return (
          <button
            key={p.validFrom ?? 'unknown'}
            type="button"
            onClick={() => onPick(p.validFrom)}
            aria-pressed={isActive}
            className={[
              'flex flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-colors',
              isActive
                ? 'border-paprika bg-paprika text-cream shadow-sm'
                : 'border-cream-shadow bg-cream text-ink hover:border-paprika/55',
            ].join(' ')}
          >
            <span
              className={[
                'font-mono text-[0.54rem] uppercase tracking-[0.18em]',
                isActive ? 'text-cream/75' : 'text-paprika',
              ].join(' ')}
            >
              {p.isCurrent ? 'This week' : 'Next week'}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-display" style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                {formatWeek(p.validFrom, p.validTo)}
              </span>
              <span className={['num text-[0.7rem]', isActive ? 'text-cream/70' : 'text-chestnut-soft'].join(' ')}>
                {p.count}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function EmptyPromos({ isAdmin, onRefresh, refreshing }: { isAdmin: boolean; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="border border-cream-shadow rounded-2xl px-8 py-14 text-center max-w-xl mx-auto">
      <p className="eyebrow text-paprika mb-3">Nothing loaded yet</p>
      <p className="text-ink-soft text-lg leading-relaxed mb-6" style={{ fontFamily: 'var(--font-body)' }}>
        {isAdmin
          ? `Pull this week's ${STORE_NAME} promotions to get started.`
          : `This week's ${STORE_NAME} promotions haven't been loaded yet. Ask an admin to refresh them.`}
      </p>
      {isAdmin && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 bg-paprika text-cream font-display font-semibold hover:bg-paprika-deep transition-colors disabled:opacity-50"
        >
          <span aria-hidden className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh promos'}
        </button>
      )}
    </div>
  )
}

// Row on mobile (image left, AH-style list), big photo card from sm up. A single product adds
// to the cart on tap; a group tile (multiple products) drills into its members instead. The
// corner control adds a single product to the cart and flips to a tick once it's in.
function PromoCard({
  promo,
  added,
  onAdd,
  onDrill,
}: {
  promo: PromotionDto
  added: boolean
  onAdd: (origin: DOMRect | null) => void
  onDrill: () => void
}) {
  const isGroup = promo.productCount > 1
  const imgRef = useRef<HTMLSpanElement>(null)
  const add = () => onAdd(imgRef.current?.getBoundingClientRect() ?? null)
  return (
    <div
      className={[
        'group relative flex flex-row sm:flex-col rounded-2xl border overflow-hidden bg-cream transition-colors',
        added ? 'border-paprika ring-2 ring-inset ring-paprika/40' : 'border-cream-shadow hover:border-paprika/55',
      ].join(' ')}
    >
      {/* The whole card is the action: a single product adds; a group opens its products. */}
      <button type="button" onClick={isGroup ? onDrill : add} className="text-left flex flex-row sm:flex-col flex-1 min-w-0">
        <span ref={imgRef} className="relative shrink-0 w-24 sm:w-full aspect-square bg-cream-deep grid place-items-center overflow-hidden">
          {promo.imageUrl ? (
            <img src={promo.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden className="text-3xl opacity-40">🛒</span>
          )}
        </span>

        <span className="flex-1 min-w-0 flex flex-col gap-1.5 px-3 py-2.5 sm:py-3">
          <span className="font-display text-ink text-[0.9rem] leading-tight line-clamp-2" style={{ fontWeight: 600 }}>
            {promo.name}
          </span>
          {promo.packSize && (
            <span className="-mt-0.5 font-mono text-[0.54rem] uppercase tracking-[0.1em] text-chestnut-soft">{promo.packSize}</span>
          )}

          {/* Deal label — on its own line so it has room; dark text on gold reads clearly. */}
          {promo.discountLabel && (
            <span className="self-start rounded-md bg-butter px-2 py-1 font-display text-[0.82rem] font-bold leading-none text-[#3b2a05] shadow-sm">
              {promo.discountLabel}
            </span>
          )}

          {/* Price — its own line, never crowded by the deal badge. */}
          {promo.promoPrice != null ? (
            <span className="flex items-baseline gap-1.5">
              <span className="num text-paprika text-base">{euro.format(promo.promoPrice)}</span>
              {promo.originalPrice != null && promo.originalPrice > promo.promoPrice && (
                <span className="num text-chestnut-soft text-xs line-through">{euro.format(promo.originalPrice)}</span>
              )}
            </span>
          ) : promo.originalPrice != null ? (
            <span className="num text-ink text-sm">{euro.format(promo.originalPrice)}</span>
          ) : null}

          {/* Affordance (the card itself is the button): filled "Add" = one product,
              outlined "N producten" = a group you open. */}
          <span className="mt-auto pt-1.5">
            {isGroup ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-paprika/45 px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-paprika-deep transition-colors group-hover:border-paprika group-hover:bg-paprika group-hover:text-cream">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="13" height="13" rx="2" />
                  <path d="M8 21h11a2 2 0 0 0 2-2V8" />
                </svg>
                {promo.productCount} producten
                <span aria-hidden>→</span>
              </span>
            ) : (
              <span
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display font-semibold text-[0.82rem] transition-colors',
                  added ? 'bg-paprika/15 text-paprika-deep' : 'bg-paprika text-cream group-hover:bg-paprika-deep',
                ].join(' ')}
              >
                {added ? '✓ In cart' : '+ Add'}
              </span>
            )}
          </span>
        </span>
      </button>
    </div>
  )
}

// One member product inside the drill-down; adds itself to the cart and flies its image up.
function DrillRow({
  product,
  inCart,
  onAdd,
}: {
  product: PromotionDto
  inCart: boolean
  onAdd: (promo: PromotionDto, origin: DOMRect | null) => void
}) {
  const imgRef = useRef<HTMLSpanElement>(null)
  return (
    <li>
      {/* The whole row adds to the cart; the pill on the right is just the affordance. */}
      <button
        type="button"
        onClick={() => onAdd(product, imgRef.current?.getBoundingClientRect() ?? null)}
        aria-label={inCart ? `Add ${product.name} again` : `Add ${product.name} to cart`}
        className="group w-full flex items-center gap-4 py-3 px-2 -mx-2 rounded-xl text-left hover:bg-cream-deep/60 transition-colors"
      >
        <span ref={imgRef} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-cream-shadow bg-cream-deep grid place-items-center">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden className="opacity-40">🛒</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-ink leading-tight line-clamp-2" style={{ fontWeight: 600 }}>
            {product.name}
          </span>
          {product.packSize && (
            <span className="block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-chestnut-soft mt-0.5">{product.packSize}</span>
          )}
          {product.promoPrice != null && <span className="block num text-paprika text-base mt-0.5">{euro.format(product.promoPrice)}</span>}
        </span>
        <span
          className={[
            'shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-display font-semibold text-[0.8rem] transition-colors',
            inCart ? 'bg-paprika/15 text-paprika-deep' : 'bg-paprika text-cream group-hover:bg-paprika-deep',
          ].join(' ')}
        >
          {inCart ? '✓ In cart' : '+ Add'}
        </span>
      </button>
    </li>
  )
}

// Modal listing a group's member products; each can be added to the cart.
function GroupDrillDown({
  group,
  week,
  added,
  onAdd,
  onClose,
}: {
  group: PromotionDto
  week: string | null
  added: Set<string>
  onAdd: (promo: PromotionDto, origin: DOMRect | null) => void
  onClose: () => void
}) {
  const q = useQuery({
    queryKey: ['promo-group', STORE, week, group.sku],
    queryFn: () => promotionsApi.groupProducts(STORE, group.sku, week),
    staleTime: 60_000,
  })
  const products = q.data ?? []

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col bg-cream rounded-t-3xl sm:rounded-2xl border border-cream-shadow overflow-hidden shadow-2xl shadow-ink/25"
      >
        <header className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-cream-shadow">
          <div className="min-w-0">
            <p className="eyebrow text-paprika mb-1.5">{group.category ?? 'Bonus'}</p>
            <h2
              className="font-display text-ink leading-tight"
              style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em' }}
            >
              {group.name}
            </h2>
            {group.discountLabel && (
              <span className="inline-block mt-2 px-2 py-1 rounded-md bg-paprika text-cream font-mono text-[0.58rem] uppercase tracking-[0.08em] leading-none">
                {group.discountLabel}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="overflow-y-auto px-5 sm:px-6 py-5">
          {q.isPending ? (
            <p className="eyebrow text-chestnut">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="text-ink-soft leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
              No individual products listed for this deal.
            </p>
          ) : (
            <ul className="divide-y divide-cream-shadow">
              {products.map((p) => (
                <DrillRow key={p.sku} product={p} inCart={added.has(p.sku)} onAdd={onAdd} />
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
