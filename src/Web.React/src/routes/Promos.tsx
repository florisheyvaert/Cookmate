import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { promotionsApi } from '@/api/promotions'
import type { PromoPeriod, PromotionDto } from '@/api/promotions'
import { cartApi } from '@/api/shoppingCart'

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

  const periodsQ = useQuery({
    queryKey: ['promo-periods', STORE],
    queryFn: () => promotionsApi.periods(STORE),
    staleTime: 5 * 60_000,
  })

  const periods = periodsQ.data ?? []
  const currentWeek = periods.find((p) => p.isCurrent)?.validFrom ?? periods[0]?.validFrom ?? null
  const activeWeek = params.get('week') ?? currentWeek

  const promosQ = useQuery({
    queryKey: ['promotions', STORE, activeWeek],
    queryFn: () => promotionsApi.list(STORE, activeWeek),
    staleTime: 5 * 60_000,
  })
  const promos = promosQ.data ?? []

  function pickWeek(validFrom: string | null) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        validFrom ? p.set('week', validFrom) : p.delete('week')
        return p
      },
      { replace: true },
    )
  }

  const addToCart = useMutation({
    mutationFn: (item: { sku: string; name: string; imageUrl: string | null }) =>
      cartApi.add({ displayName: item.name, storeCode: STORE, sku: item.sku, imageUrl: item.imageUrl, source: 1 }),
    onSuccess: (_id, item) => {
      setAdded((prev) => new Set(prev).add(item.sku))
      qc.invalidateQueries({ queryKey: ['shopping-cart'] })
      qc.invalidateQueries({ queryKey: ['cart-dishes'] })
    },
  })

  // Scroll-to-load: reveal the already-fetched week in batches.
  const [visible, setVisible] = useState(PAGE)
  useEffect(() => setVisible(PAGE), [activeWeek])
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
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 py-8 sm:py-12 pb-20 max-w-[1400px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8 sm:mb-10">
        <div>
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
          <p className="mt-4 text-ink-soft text-lg leading-relaxed max-w-xl" style={{ fontFamily: 'var(--font-body)' }}>
            Browse the bonus and add what you want to your cart. See what you can cook with it over on the cart.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-3 border border-cream-shadow text-ink font-mono text-[0.66rem] uppercase tracking-[0.16em] hover:border-paprika hover:text-paprika transition-colors disabled:opacity-50"
          >
            <span aria-hidden className={refresh.isPending ? 'animate-spin' : ''}>↻</span>
            {refresh.isPending ? 'Refreshing…' : 'Refresh promos'}
          </button>
        )}
      </header>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {g.items.map((p) => (
                    <PromoCard
                      key={p.sku}
                      promo={p}
                      added={added.has(p.sku)}
                      adding={addToCart.isPending}
                      onAdd={() => addToCart.mutate({ sku: p.sku, name: p.name, imageUrl: p.imageUrl })}
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
            onAdd={(item) => addToCart.mutate(item)}
            onClose={() => setDrillGroup(null)}
          />
        )}
      </AnimatePresence>
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
  adding,
  onAdd,
  onDrill,
}: {
  promo: PromotionDto
  added: boolean
  adding: boolean
  onAdd: () => void
  onDrill: () => void
}) {
  const isGroup = promo.productCount > 1
  return (
    <div
      className={[
        'group relative flex flex-row sm:flex-col rounded-2xl border overflow-hidden bg-cream transition-colors',
        added ? 'border-paprika ring-2 ring-inset ring-paprika/40' : 'border-cream-shadow hover:border-paprika/55',
      ].join(' ')}
    >
      <button type="button" onClick={isGroup ? onDrill : onAdd} className="text-left flex flex-row sm:flex-col flex-1 min-w-0">
        <span className="relative shrink-0 w-28 sm:w-full aspect-square bg-cream-deep grid place-items-center overflow-hidden">
          {promo.imageUrl ? (
            <img src={promo.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden className="text-3xl opacity-40">🛒</span>
          )}
        </span>

        <span className="flex-1 min-w-0 flex flex-col gap-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
          <span
            className="font-display text-ink text-[0.95rem] sm:text-base leading-tight line-clamp-2"
            style={{ fontWeight: 600 }}
          >
            {promo.name}
          </span>
          {promo.packSize && (
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-chestnut-soft">{promo.packSize}</span>
          )}
          <span className="mt-auto flex items-center flex-wrap gap-x-2 gap-y-1.5 pt-1.5">
            {promo.discountLabel && (
              <span className="px-2 py-1 rounded-md bg-paprika text-cream font-mono text-[0.58rem] uppercase tracking-[0.08em] leading-none">
                {promo.discountLabel}
              </span>
            )}
            {promo.promoPrice != null ? (
              <span className="flex items-baseline gap-1.5">
                <span className="num text-paprika text-lg">{euro.format(promo.promoPrice)}</span>
                {promo.originalPrice != null && promo.originalPrice > promo.promoPrice && (
                  <span className="num text-chestnut-soft text-xs line-through">{euro.format(promo.originalPrice)}</span>
                )}
              </span>
            ) : promo.originalPrice != null ? (
              <span className="num text-ink text-sm">{euro.format(promo.originalPrice)}</span>
            ) : null}
          </span>
          {isGroup && (
            <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-chestnut group-hover:text-paprika transition-colors">
              {promo.productCount} producten ›
            </span>
          )}
        </span>
      </button>

      {/* Add to cart — single products only; groups add their members from the drill-down. */}
      {!isGroup && (
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          aria-label={added ? 'In cart' : 'Add to cart'}
          className={[
            'absolute top-2 right-2 w-8 h-8 rounded-full grid place-items-center text-[0.9rem] leading-none transition-colors shadow-sm disabled:opacity-60',
            added ? 'bg-paprika text-cream' : 'bg-cream/90 text-chestnut hover:text-paprika',
          ].join(' ')}
        >
          <span aria-hidden>{added ? '✓' : '+'}</span>
        </button>
      )}
    </div>
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
  onAdd: (item: { sku: string; name: string; imageUrl: string | null }) => void
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
              {products.map((p) => {
                const inCart = added.has(p.sku)
                return (
                  <li key={p.sku} className="flex items-center gap-4 py-3">
                    <span className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-cream-shadow bg-cream-deep grid place-items-center">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <span aria-hidden className="opacity-40">🛒</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-ink leading-tight line-clamp-2" style={{ fontWeight: 600 }}>
                        {p.name}
                      </p>
                      {p.packSize && (
                        <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-chestnut-soft mt-0.5">
                          {p.packSize}
                        </p>
                      )}
                      {p.promoPrice != null && <p className="num text-paprika text-base mt-0.5">{euro.format(p.promoPrice)}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAdd({ sku: p.sku, name: p.name, imageUrl: p.imageUrl })}
                      aria-label={inCart ? 'In cart' : 'Add to cart'}
                      className={[
                        'shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-display font-semibold text-[0.8rem] transition-colors',
                        inCart ? 'bg-paprika/15 text-paprika-deep' : 'bg-paprika text-cream hover:bg-paprika-deep',
                      ].join(' ')}
                    >
                      {inCart ? '✓ In cart' : '+ Add'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
