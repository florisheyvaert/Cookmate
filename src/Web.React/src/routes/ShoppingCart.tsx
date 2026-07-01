import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { cartApi, type Cart, type CartDish, type CartLine } from '@/api/shoppingCart'
import { shoppingApi, type GroceryProductCandidateDto } from '@/api/shopping'
import { PlanSuggestionDialog } from '@/components/PlanSuggestionDialog'
import { Listbox, type ListboxOption } from '@/components/Listbox'
import { CartSortToggle } from '@/components/CartSortToggle'
import { Carousel } from '@/components/Carousel'
import { ProductSearchDialog } from '@/components/ProductSearchDialog'
import { SourceMark } from '@/components/SourceMark'
import { formatHostname } from '@/lib/format'
import { useCartSort, groupByCategory, sortAZ } from '@/lib/cartSort'
import { useConfirm } from '@/components/confirm/ConfirmDialog'
import { btnPrimary, btnGhostSm } from '@/lib/ui'

const ease = [0.22, 1, 0.36, 1] as const
const CART_KEY = ['shopping-cart']

const SOURCE_LABEL: Record<number, string> = { 1: 'bonus', 2: 'meal plan' }

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function ShoppingCart() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [storeCode, setStoreCode] = useState('ah')
  const [search, setSearch] = useState<{ mode: 'add' } | { mode: 'link'; line: CartLine } | null>(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [showDishes, setShowDishes] = useState(false)
  const [sortMode, setSortMode] = useCartSort()
  // The last line you removed — kept briefly so you can undo an accidental delete.
  const [undo, setUndo] = useState<CartLine | null>(null)

  const storesQ = useQuery({ queryKey: ['shop-stores'], queryFn: () => shoppingApi.listStores() })
  const cartQ = useQuery({ queryKey: CART_KEY, queryFn: () => cartApi.get() })

  const storeOptions: ListboxOption[] = (storesQ.data ?? [{ code: 'ah', displayName: 'Albert Heijn' }]).map((s) => ({
    value: s.code,
    label: s.displayName,
  }))
  const storeName = storeOptions.find((o) => o.value === storeCode)?.label ?? storeCode

  const items = cartQ.data?.items ?? []
  const invalidate = () => qc.invalidateQueries({ queryKey: CART_KEY })

  const addItem = useMutation({ mutationFn: cartApi.add, onSuccess: invalidate })
  const setQty = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) => cartApi.setQuantity(id, quantity),
    onSuccess: invalidate,
  })
  // Optimistic remove so a swipe-to-delete feels instant; rolled back if the server rejects.
  const removeItem = useMutation({
    mutationFn: (id: number) => cartApi.remove(id),
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: CART_KEY })
      const prev = qc.getQueryData<Cart>(CART_KEY)
      if (prev) qc.setQueryData<Cart>(CART_KEY, { ...prev, items: prev.items.filter((i) => i.id !== id) })
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(CART_KEY, ctx.prev)
    },
    onSettled: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['cart-dishes'] })
    },
  })
  const linkItem = useMutation({
    mutationFn: ({ id, p }: { id: number; p: GroceryProductCandidateDto }) =>
      cartApi.link(id, { storeCode, sku: p.sku, productName: p.name, imageUrl: p.imageUrl }),
    onSuccess: invalidate,
  })
  const clear = useMutation({ mutationFn: cartApi.clear, onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['cart-dishes'] }) } })
  const addPeriod = useMutation({
    mutationFn: (b: { from: string; to: string }) => cartApi.addPeriod({ storeCode, from: b.from, to: b.to }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['cart-dishes'] })
      setPeriodOpen(false)
    },
  })

  const sendDeeplink = useMutation({
    mutationFn: () => {
      const linked = items
        .filter((i) => i.isLinked && i.storeCode === storeCode && i.sku)
        .map((i) => ({ sku: i.sku!, quantity: i.quantity }))
      return shoppingApi.buildDeeplink(storeCode, linked)
    },
    onSuccess: (r) => {
      if (r.deeplink) window.open(r.deeplink, '_blank', 'noopener')
    },
  })

  // Free-text add, driven by the "Add '<query>'" row inside the search dialog.
  function addText(text: string) {
    const name = text.trim()
    if (!name) return
    addItem.mutate({ displayName: name })
    setSearch(null)
  }

  function onPick(p: GroceryProductCandidateDto) {
    if (search?.mode === 'link') {
      linkItem.mutate({ id: search.line.id, p })
    } else {
      addItem.mutate({ displayName: p.name, storeCode, sku: p.sku, imageUrl: p.imageUrl })
    }
    setSearch(null)
  }

  async function onClear() {
    if (items.length === 0) return
    const ok = await confirm.ask({
      title: 'Empty the cart?',
      body: 'Everything in the cart is removed. This cannot be undone.',
      confirmLabel: 'Empty cart',
      destructive: true,
    })
    if (ok) clear.mutate()
  }

  function handleRemove(line: CartLine) {
    setUndo(line)
    removeItem.mutate(line.id)
  }

  // Re-add the last removed line, restoring its quantity, link and source.
  function handleUndo() {
    if (!undo) return
    const l = undo
    setUndo(null)
    addItem.mutate({
      displayName: l.displayName,
      storeCode: l.storeCode,
      sku: l.sku,
      imageUrl: l.imageUrl,
      category: l.category,
      quantity: l.quantity,
      source: l.source,
    })
  }

  // The undo offer fades on its own after a few seconds.
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 6000)
    return () => clearTimeout(t)
  }, [undo])

  // Measure the checkout footer so the undo toast can float a clear gap above it.
  const footerRef = useRef<HTMLDivElement>(null)
  const [footerH, setFooterH] = useState(64)
  const hasCheckout = items.length > 0
  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFooterH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasCheckout])

  const linkedForStore = items.filter((i) => i.isLinked && i.storeCode === storeCode).length
  const totalItems = items.reduce((n, i) => n + i.quantity, 0)
  const isMobile = useIsMobile()

  // Free text you typed (manual, unlinked) floats to the very top; everything else sorts
  // by the chosen mode below it.
  const freeTextLines = sortAZ(items.filter((i) => !i.isLinked && i.source === 0))
  const otherLines = items.filter((i) => i.isLinked || i.source !== 0)
  const cartGroups = [
    ...(freeTextLines.length > 0 ? [{ category: 'Free text', items: freeTextLines }] : []),
    ...(sortMode === 'category'
      ? groupByCategory(otherLines)
      : otherLines.length > 0
        ? [{ category: '', items: sortAZ(otherLines) }]
        : []),
  ]

  return (
    // App-shell: centred column, at least a viewport tall (minus the sticky header), so the
    // checkout can sit at the bottom without the page hugging the left edge.
    <div className="mx-auto flex min-h-[calc(100dvh-3.75rem)] w-full max-w-3xl flex-col px-5 sm:px-6 lg:px-8 pt-10 md:pt-12">
      {/* ── Masthead ────────────────────────────────────────────────────────── */}
      <header className="mb-6">
        <p className="eyebrow mb-2.5">Cookbook · Shopping cart</p>
        <div className="flex items-end justify-between gap-4">
          <h1
            className="text-ink"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.1rem)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.035em' }}
          >
            Your{' '}
            <span className="italic" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-paprika)' }}>
              basket
            </span>
          </h1>
          {items.length > 0 && (
            <span className="shrink-0 text-right leading-none">
              <span className="block num text-2xl text-paprika">{totalItems}</span>
              <span className="mt-1 block font-mono text-[0.54rem] uppercase tracking-[0.16em] text-chestnut-soft">
                item{totalItems === 1 ? '' : 's'}
              </span>
            </span>
          )}
        </div>
      </header>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <button type="button" onClick={() => setSearch({ mode: 'add' })} className={btnPrimary + ' w-full justify-center py-3'}>
        + Add product
      </button>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setPeriodOpen(true)} className={btnGhostSm + ' justify-center'}>
          + Add my meal plan
        </button>
        <button
          type="button"
          onClick={() => setShowDishes((v) => !v)}
          aria-expanded={showDishes}
          className={btnGhostSm + ' justify-center'}
        >
          🍳 {showDishes ? 'Hide dishes' : 'What can I make?'}
        </button>
      </div>

      {/* What can I make — reveals right under the actions */}
      <AnimatePresence initial={false}>
        {showDishes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden"
          >
            <WhatCanIMake />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart body (grows to fill; the checkout sticks to its bottom) ─────── */}
      <div className={items.length === 0 ? 'mt-7 flex-1 grid place-items-center' : 'mt-7 flex-1'}>
      {cartQ.isPending ? (
        <p className="font-mono text-[0.7rem] text-chestnut-soft">Loading…</p>
      ) : items.length === 0 ? (
        <div className="max-w-sm mx-auto border border-dashed border-cream-shadow rounded-2xl px-8 py-12 text-center">
          <p className="text-3xl mb-3" aria-hidden>🧺</p>
          <p className="text-ink-soft text-lg leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
            Your basket is empty. Add a product, pull in a week from your plan, or just type something with “Add product”.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            {items.length > 1 && <CartSortToggle mode={sortMode} onChange={setSortMode} size="sm" />}
            <button
              type="button"
              onClick={onClear}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-red-600 hover:bg-red-500/10 hover:border-red-500/60 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              Empty cart
            </button>
          </div>
          <div className="space-y-6">
            {cartGroups.map((group) => (
              <section key={group.category || 'all'}>
                {group.category !== '' && items.length > 1 && (sortMode === 'category' || cartGroups.length > 1) && (
                  <div className="flex items-baseline gap-2.5 mb-2.5">
                    <h3 className="eyebrow text-ink">{group.category}</h3>
                    <span className="num text-chestnut-soft text-xs">{group.items.length}</span>
                    <span className="flex-1 h-px bg-cream-shadow" />
                  </div>
                )}
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {group.items.map((line) => (
                      <CartRow
                        key={line.id}
                        line={line}
                        isMobile={isMobile}
                        busy={setQty.isPending}
                        onInc={() => setQty.mutate({ id: line.id, quantity: line.quantity + 1 })}
                        onDec={() => setQty.mutate({ id: line.id, quantity: line.quantity - 1 })}
                        onRemove={() => handleRemove(line)}
                        onLink={() => setSearch({ mode: 'link', line })}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
      </div>

      {/* ── Undo toast — a small floating pill above the checkout, never a full-width bar ── */}
      <div
        className="pointer-events-none sticky z-30 -mx-5 sm:-mx-6 lg:-mx-8 px-5 sm:px-6 lg:px-8 flex justify-center"
        style={{ bottom: hasCheckout ? footerH + 16 : 18 }}
      >
        <AnimatePresence>
          {undo && (
            <motion.div
              key="undo"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease }}
              className="pointer-events-auto inline-flex max-w-full items-center gap-3 rounded-full border border-cream-shadow bg-cream py-1.5 pl-4 pr-1.5 shadow-[0_6px_20px_-8px_rgba(20,30,18,0.4)]"
            >
              <span className="min-w-0 truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-chestnut-soft">
                Removed “{undo.displayName}”
              </span>
              <button
                type="button"
                onClick={handleUndo}
                className="shrink-0 rounded-full bg-paprika/12 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paprika hover:bg-paprika/20 transition-colors"
              >
                Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Checkout — sticks to the bottom while scrolling, never over the colophon ── */}
      {items.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-5 sm:-mx-6 lg:-mx-8 px-5 sm:px-6 lg:px-8 pt-5 pb-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <div
            ref={footerRef}
            className="rounded-2xl border border-cream-shadow bg-cream-deep shadow-[0_-6px_24px_-12px_rgba(20,30,18,0.3)] p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[0.7rem] text-chestnut leading-none">
                <span className="num text-paprika text-base">{linkedForStore}</span> item{linkedForStore === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => sendDeeplink.mutate()}
                disabled={linkedForStore === 0 || sendDeeplink.isPending}
                className={btnPrimary + ' shrink-0 disabled:opacity-50'}
                title={linkedForStore === 0 ? 'Link some products first' : undefined}
              >
                {sendDeeplink.isPending ? 'Opening…' : `Send to ${storeName} →`}
              </button>
            </div>
            {items.length > linkedForStore && (
              <p className="mt-3 text-center font-mono text-[0.56rem] uppercase tracking-[0.12em] text-chestnut-soft">
                free text stays in your list
              </p>
            )}
          </div>
        </div>
      )}

      {search != null && (
        <ProductSearchDialog
          storeCode={storeCode}
          heading={search.mode === 'link' ? `Link "${search.line.displayName}"` : 'Add a product'}
          initialQuery={search.mode === 'link' ? search.line.displayName : ''}
          onAddText={search.mode === 'add' ? addText : undefined}
          onPick={onPick}
          onClose={() => setSearch(null)}
        />
      )}

      <PeriodDialog
        open={periodOpen}
        pending={addPeriod.isPending}
        storeCode={storeCode}
        storeOptions={storeOptions}
        onStoreChange={setStoreCode}
        onClose={() => setPeriodOpen(false)}
        onConfirm={(from, to) => addPeriod.mutate({ from, to })}
      />
    </div>
  )
}

function CartRow({
  line,
  isMobile,
  busy,
  onInc,
  onDec,
  onRemove,
  onLink,
}: {
  line: CartLine
  isMobile: boolean
  busy: boolean
  onInc: () => void
  onDec: () => void
  onRemove: () => void
  onLink: () => void
}) {
  const x = useMotionValue(0)
  // The red "delete" tray fades in as you slide either way; full red past the threshold.
  const trayOpacity = useTransform(x, [-96, -34, 0, 34, 96], [1, 0.5, 0, 0.5, 1])
  const SWIPE = 88

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.22, ease }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Mobile only: swipe the row aside to reveal this, far enough = delete. */}
      {isMobile && (
        <motion.div
          aria-hidden
          style={{ opacity: trayOpacity }}
          className="absolute inset-0 flex items-center justify-between px-5 bg-red-500 text-cream"
        >
          <TrashGlyph />
          <TrashGlyph />
        </motion.div>
      )}

      <motion.div
        drag={isMobile ? 'x' : false}
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        dragMomentum={false}
        onDragEnd={(_e, info) => {
          if (Math.abs(info.offset.x) > SWIPE) onRemove()
        }}
        className="relative flex items-center gap-3 rounded-2xl border border-cream-shadow bg-cream-deep px-3.5 py-3.5"
      >
        <span className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-cream-shadow bg-cream grid place-items-center">
          {line.imageUrl ? (
            <img src={line.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden className="text-lg opacity-40">{line.isLinked ? '🛒' : '✎'}</span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-display text-ink leading-tight line-clamp-2" style={{ fontWeight: 600, fontSize: '0.98rem' }}>
            {line.displayName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {SOURCE_LABEL[line.source] && (
              <span className="font-mono text-[0.54rem] uppercase tracking-[0.12em] text-chestnut-soft">{SOURCE_LABEL[line.source]}</span>
            )}
            {!line.isLinked && (
              <button type="button" onClick={onLink} className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-chestnut hover:text-paprika transition-colors">
                + link product
              </button>
            )}
          </div>
        </div>

        {/* Quantity stepper */}
        <div className="shrink-0 flex items-center gap-1.5">
          <button type="button" onClick={onDec} disabled={busy} aria-label="Less" className={stepBtn}>−</button>
          <span className="num text-sm text-ink w-5 text-center tabular-nums">{line.quantity}</span>
          <button type="button" onClick={onInc} disabled={busy} aria-label="More" className={stepBtn}>+</button>
        </div>

        {/* Desktop keeps an explicit remove; on mobile you swipe instead. */}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="hidden sm:grid shrink-0 w-8 h-8 place-items-center rounded-lg text-chestnut-soft hover:text-red-600 hover:bg-red-500/10 transition-colors"
        >
          <span aria-hidden className="text-base leading-none">×</span>
        </button>
      </motion.div>
    </motion.li>
  )
}

function TrashGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

// Below Tailwind's `sm` breakpoint — drives the swipe-to-delete vs the explicit × button.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

const stepBtn =
  'w-7 h-7 grid place-items-center rounded-lg border border-cream-shadow text-ink hover:border-paprika hover:text-paprika disabled:opacity-40 transition-colors text-base leading-none'

function WhatCanIMake() {
  const qc = useQueryClient()
  const [limit, setLimit] = useState(12)
  const dishesQ = useQuery({
    queryKey: ['cart-dishes', limit],
    queryFn: () => cartApi.dishes(limit),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  // The dish whose action sheet is open (photo tapped).
  const [selected, setSelected] = useState<CartDish | null>(null)
  // The dish being dropped onto the meal plan (plan dialog stacks over the sheet).
  const [planning, setPlanning] = useState<CartDish | null>(null)
  const dishes = dishesQ.data ?? []
  // The query returns up to `limit`; if it's full there are probably more to fetch.
  const hasMore = dishes.length >= limit && limit < 96

  // Drop every ingredient this dish is missing into the cart as free text.
  const addMissing = useMutation({
    mutationFn: async (dish: CartDish) => {
      for (const name of dish.missingIngredients) await cartApi.add({ displayName: name })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CART_KEY })
      qc.invalidateQueries({ queryKey: ['cart-dishes'] })
      setSelected(null)
    },
  })

  return (
    <div className="mt-4">
      {dishesQ.isPending ? (
        <p className="eyebrow text-chestnut">Finding dishes…</p>
      ) : dishes.length === 0 ? (
        <p className="text-ink-soft leading-relaxed max-w-lg" style={{ fontFamily: 'var(--font-body)' }}>
          Nothing matches yet — add a few real ingredients (eggs, milk, chicken…) and dishes that use them show up here.
        </p>
      ) : (
        <Carousel ariaLabel="Dishes you can make" hasMore={hasMore} onLoadMore={() => setLimit((l) => Math.min(l + 12, 96))}>
          {dishes.map((d) => (
            <div key={d.suggestionId} className="shrink-0 snap-start basis-[78%] sm:basis-[46%] lg:basis-[31%]">
              <DishCard dish={d} onOpen={() => setSelected(d)} />
            </div>
          ))}
        </Carousel>
      )}

      <DishActionDialog
        dish={selected}
        adding={addMissing.isPending}
        onClose={() => {
          if (!addMissing.isPending) setSelected(null)
        }}
        onPlan={() => {
          setPlanning(selected)
          setSelected(null)
        }}
        onAddMissing={() => selected && addMissing.mutate(selected)}
      />

      <PlanSuggestionDialog
        open={planning != null}
        onClose={() => setPlanning(null)}
        title={planning?.title ?? ''}
        sourceUrl={planning?.sourceUrl}
        suggestionId={planning?.suggestionId}
        baseServings={planning?.baseServings}
        imageUrl={planning?.imageUrl}
        sourceFaviconUrl={planning?.sourceFaviconUrl}
        sourceName={formatHostname(planning?.sourceUrl ?? null)}
      />
    </div>
  )
}

// A dish reduced to just its photo + name, with a hairline progress bar showing
// how much of it is already in the cart. Tapping anywhere opens the action sheet.
function DishCard({ dish, onOpen }: { dish: CartDish; onOpen: () => void }) {
  const total = dish.relevantIngredientCount
  const matched = dish.matchedIngredientCount
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-cream-shadow bg-cream text-left transition-colors hover:border-paprika/50"
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-cream-deep">
        {dish.imageUrl ? (
          <img
            src={dish.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span aria-hidden className="grid h-full w-full place-items-center text-3xl opacity-40">🍽️</span>
        )}
        <SourceMark faviconUrl={dish.sourceFaviconUrl} sourceName={formatHostname(dish.sourceUrl)} />
      </span>
      <span className="flex flex-col gap-2.5 p-3.5">
        <span className="font-display text-ink leading-tight line-clamp-2" style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1rem' }}>
          {dish.title}
        </span>
        <span className="block">
          <span className="block h-1 w-full overflow-hidden rounded-full bg-cream-shadow/70">
            <span className="block h-full rounded-full bg-paprika/70 transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </span>
          <span className="mt-1.5 block font-mono text-[0.56rem] uppercase tracking-[0.12em] text-chestnut-soft">
            {matched}/{total} items in cart
          </span>
        </span>
      </span>
    </button>
  )
}

// Tapping a dish opens this: three ways forward — plan it, top up the cart with
// what it's missing, or read the full recipe.
const dishActionRow =
  'flex w-full items-center gap-3.5 rounded-xl border border-cream-shadow px-4 py-3 text-left no-underline transition-colors hover:border-paprika/50 hover:bg-paprika/5 disabled:opacity-45 disabled:pointer-events-none'

function DishActionDialog({
  dish,
  adding,
  onClose,
  onPlan,
  onAddMissing,
}: {
  dish: CartDish | null
  adding: boolean
  onClose: () => void
  onPlan: () => void
  onAddMissing: () => void
}) {
  useEffect(() => {
    if (!dish) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [dish, onClose])

  const missing = dish?.missingIngredients.length ?? 0

  return (
    <AnimatePresence>
      {dish && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 bg-ink/45 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
      )}
      {dish && (
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.22, ease }}
          className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 pointer-events-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-action-title"
        >
          <div className="grain w-full max-w-md bg-cream border border-chestnut/30 shadow-[0_24px_60px_-12px_rgba(26,20,16,0.35)] pointer-events-auto rounded-sm">
            <div className="flex items-start gap-3.5 px-6 pt-6 pb-5">
              <span className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-cream-shadow bg-cream-deep grid place-items-center">
                {dish.imageUrl ? (
                  <img src={dish.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span aria-hidden className="text-lg opacity-40">🍽️</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-1">What next?</p>
                <h2
                  id="dish-action-title"
                  className="font-display text-ink leading-tight line-clamp-2"
                  style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.15rem' }}
                >
                  {dish.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 -mr-1 -mt-1 h-8 w-8 grid place-items-center rounded-lg text-chestnut hover:text-paprika transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="border-t border-cream-shadow px-6 py-5 flex flex-col gap-2.5">
              <button type="button" onClick={onPlan} className={dishActionRow}>
                <span aria-hidden className="text-xl">🗓</span>
                <span className="min-w-0">
                  <span className="block font-display text-ink" style={{ fontWeight: 650, fontSize: '0.95rem' }}>Plan meal</span>
                  <span className="block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-chestnut-soft">Drop it on a day in your plan</span>
                </span>
              </button>

              <button type="button" onClick={onAddMissing} disabled={missing === 0 || adding} className={dishActionRow}>
                <span aria-hidden className="text-xl">🛒</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-ink" style={{ fontWeight: 650, fontSize: '0.95rem' }}>Add missing ingredients to cart</span>
                  <span className="block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-chestnut-soft">
                    {missing === 0
                      ? 'Everything is already in your cart'
                      : adding
                        ? 'Adding…'
                        : `${missing} ingredient${missing === 1 ? '' : 's'} to add`}
                  </span>
                </span>
              </button>

              <a href={dish.sourceUrl} target="_blank" rel="noreferrer" onClick={onClose} className={dishActionRow}>
                <span aria-hidden className="text-xl">📖</span>
                <span className="min-w-0">
                  <span className="block font-display text-ink" style={{ fontWeight: 650, fontSize: '0.95rem' }}>View recipe</span>
                  <span className="block font-mono text-[0.56rem] uppercase tracking-[0.1em] text-chestnut-soft">Open the full recipe ↗</span>
                </span>
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Product search dialog ─────────────────────────────────────────────────────

// ── Add-a-week dialog ─────────────────────────────────────────────────────────

function PeriodDialog({
  open,
  pending,
  storeCode,
  storeOptions,
  onStoreChange,
  onClose,
  onConfirm,
}: {
  open: boolean
  pending: boolean
  storeCode: string
  storeOptions: ListboxOption[]
  onStoreChange: (code: string) => void
  onClose: () => void
  onConfirm: (from: string, to: string) => void
}) {
  const today = useMemo(() => new Date(), [])
  const [from, setFrom] = useState(toISO(today))
  const [to, setTo] = useState(toISO(addDays(today, 7)))
  const valid = from <= to

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-cream rounded-t-3xl sm:rounded-2xl border border-cream-shadow overflow-hidden shadow-2xl shadow-ink/25"
      >
        <div className="px-6 pt-6 pb-5">
          <p className="eyebrow text-paprika mb-1.5">Add my meal plan</p>
          <p className="text-ink-soft text-sm leading-relaxed mb-5">
            Adds everything your meal plan needs over this range to the cart — linked products where known, free text otherwise.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="eyebrow block mb-1.5">From</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
            </label>
            <label className="block">
              <span className="eyebrow block mb-1.5">To</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={dateInput} />
            </label>
          </div>
          <div className="mt-4">
            <span className="eyebrow block mb-1.5">Store</span>
            <Listbox ariaLabel="Store" value={storeCode} onChange={onStoreChange} options={storeOptions} />
          </div>
        </div>
        <div className="border-t border-cream-shadow px-6 py-4 flex items-center justify-end gap-4">
          <button type="button" onClick={onClose} className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors">Cancel</button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => onConfirm(from, to)}
            className={btnPrimary + ' disabled:opacity-50'}
          >
            {pending ? 'Adding…' : 'Add to cart'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const dateInput =
  'w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 font-mono text-sm text-ink transition-colors'
