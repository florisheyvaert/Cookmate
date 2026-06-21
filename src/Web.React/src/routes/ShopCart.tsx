import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { shoppingApi } from '@/api/shopping'
import type { CartItemDto, DeeplinkItem, GroceryProductCandidateDto } from '@/api/shopping'
import { PageHeader } from '@/components/PageHeader'
import { SearchProductDialog } from '@/components/SearchProductDialog'
import { btnPrimary, quietBtn } from '@/lib/ui'

const ease = [0.22, 1, 0.36, 1] as const
const STORE_BROWSE_URLS: Record<string, string> = { ah: 'https://www.ah.nl/zoeken?query=' }

function formatAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return n === Math.trunc(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
function formatRange(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d))
  }
  return `${fmt(from)} – ${fmt(to)}`
}

type LinkTarget =
  | { kind: 'preference'; ingredientName: string; addToExtras: boolean }
  | { kind: 'manual' }
  | null

type ManualItem = { sku: string; name: string; imageUrl: string | null; packs: number }

export default function ShopCart() {
  const [params] = useSearchParams()
  const storeCode = params.get('store') || 'ah'
  const from = params.get('from') || ''
  const to = params.get('to') || ''

  const queryClient = useQueryClient()
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [extras, setExtras] = useState<Set<string>>(new Set())
  const [packOverride, setPackOverride] = useState<Record<string, number>>({})
  const [manual, setManual] = useState<ManualItem[]>([])
  const [target, setTarget] = useState<LinkTarget>(null)
  const [showIgnored, setShowIgnored] = useState(false)

  const storesQ = useQuery({ queryKey: ['shop-stores'], queryFn: () => shoppingApi.listStores() })
  const cartQ = useQuery({
    queryKey: ['weekly-cart', storeCode, from, to],
    queryFn: () => shoppingApi.weeklyCart(storeCode, from, to),
    enabled: !!from && !!to && from <= to,
  })
  const ignoredQ = useQuery({ queryKey: ['ignored-ingredients'], queryFn: () => shoppingApi.listIgnored() })

  const refetchCart = () => queryClient.invalidateQueries({ queryKey: ['weekly-cart'] })

  const setPreference = useMutation({
    mutationFn: (input: { ingredientName: string; sku: string }) =>
      shoppingApi.setPreference({ storeCode, ingredientName: input.ingredientName, sku: input.sku, defaultPackQuantity: 1 }),
    onSuccess: refetchCart,
  })
  const clearPreference = useMutation({ mutationFn: (name: string) => shoppingApi.clearPreference(storeCode, name), onSuccess: refetchCart })
  const ignore = useMutation({
    mutationFn: (name: string) => shoppingApi.ignore(name),
    onSuccess: () => {
      refetchCart()
      queryClient.invalidateQueries({ queryKey: ['ignored-ingredients'] })
    },
  })
  const unignore = useMutation({
    mutationFn: (name: string) => shoppingApi.unignore(name),
    onSuccess: () => {
      refetchCart()
      queryClient.invalidateQueries({ queryKey: ['ignored-ingredients'] })
    },
  })
  const sendToStore = useMutation({
    mutationFn: (items: DeeplinkItem[]) => shoppingApi.buildDeeplink(storeCode, items),
    onSuccess: (r) => {
      if (r.deeplink) window.open(r.deeplink, '_blank', 'noopener')
    },
  })

  const cart = cartQ.data
  const storeName = cart?.storeDisplayName ?? storesQ.data?.find((s) => s.code === storeCode)?.displayName ?? 'the store'
  const browseUrl = STORE_BROWSE_URLS[storeCode] ?? ''

  function packsFor(item: CartItemDto): number {
    return packOverride[item.ingredientName] ?? item.packs ?? 1
  }
  function setPacks(name: string, value: number) {
    setPackOverride((m) => ({ ...m, [name]: Math.max(1, value) }))
  }
  function toggle(set: Set<string>, setter: (s: Set<string>) => void, name: string) {
    const next = new Set(set)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setter(next)
  }

  const finalItems = useMemo<DeeplinkItem[]>(() => {
    if (!cart) return []
    const bySku = new Map<string, number>()
    const add = (sku: string | null | undefined, packs: number) => {
      if (!sku || packs <= 0) return
      bySku.set(sku, (bySku.get(sku) ?? 0) + packs)
    }
    for (const i of cart.toBuy) if (!excluded.has(i.ingredientName)) add(i.sku, packsFor(i))
    for (const i of cart.probablyHave) if (extras.has(i.ingredientName)) add(i.sku, packsFor(i))
    for (const m of manual) add(m.sku, m.packs)
    return [...bySku].map(([sku, quantity]) => ({ sku, quantity }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, excluded, extras, manual, packOverride])

  function onPick(candidate: GroceryProductCandidateDto) {
    if (!target) return
    if (target.kind === 'manual') {
      setManual((m) => [...m, { sku: candidate.sku, name: candidate.name, imageUrl: candidate.imageUrl, packs: 1 }])
    } else {
      setPreference.mutate({ ingredientName: target.ingredientName, sku: candidate.sku })
      if (target.addToExtras) setExtras((s) => new Set(s).add(target.ingredientName))
    }
    setTarget(null)
  }

  if (!from || !to) return <Navigate to="/shop" replace />

  const basketCount = finalItems.reduce((a, i) => a + i.quantity, 0)
  const empty = cart && cart.toBuy.length === 0 && cart.probablyHave.length === 0 && cart.unmatched.length === 0 && manual.length === 0

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-32">
      <PageHeader
        eyebrow="Cookbook · Shop"
        title="Shopping cart"
        action={
          <Link to={`/shop?store=${storeCode}&from=${from}&to=${to}`} className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors font-mono text-[0.7rem] uppercase tracking-[0.16em] no-underline">
            ← Change
          </Link>
        }
      />

      <p className="font-mono text-[0.7rem] text-chestnut mb-8">
        <span className="text-ink">{formatRange(from, to)}</span> · <span className="text-ink">{storeName}</span>
      </p>

      {cartQ.isPending && <CartSkeleton />}
      {cartQ.isError && <p className="font-mono text-[0.72rem] text-paprika-deep">Couldn't build the cart. Go back and adjust the dates.</p>}

      {cart && (
        <>
          {empty ? (
            <div className="border border-dashed border-cream-shadow rounded-2xl p-10 md:p-14 text-center">
              <p className="text-4xl mb-3" aria-hidden>🧺</p>
              <p className="eyebrow mb-2">Empty basket</p>
              <p className="text-ink-soft max-w-sm mx-auto">No meals with ingredients in this range — plan some on the calendar first.</p>
            </div>
          ) : (
            <div className="space-y-9">
              {(cart.toBuy.length > 0 || manual.length > 0) && (
                <Section tone="green" icon="🛒" title="To buy" count={cart.toBuy.length + manual.length} caption="Amounts summed across the week">
                  <ul className="space-y-2.5">
                    {cart.toBuy.map((item, i) => (
                      <BuyRow
                        key={item.ingredientName}
                        index={i}
                        item={item}
                        packs={packsFor(item)}
                        excluded={excluded.has(item.ingredientName)}
                        onPacks={(v) => setPacks(item.ingredientName, v)}
                        onToggleHave={() => toggle(excluded, setExcluded, item.ingredientName)}
                        onChange={() => setTarget({ kind: 'preference', ingredientName: item.ingredientName, addToExtras: false })}
                        onUnlink={() => clearPreference.mutate(item.ingredientName)}
                      />
                    ))}
                    {manual.map((m, i) => (
                      <li key={`m-${m.sku}-${i}`} className="rounded-xl border border-cream-shadow bg-cream-deep/40 p-3 flex items-center gap-3">
                        <Thumb url={m.imageUrl} />
                        <span className="flex-1 min-w-0">
                          <span className="block font-display text-ink truncate" style={{ fontWeight: 600 }}>{m.name}</span>
                          <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-chestnut-soft">added manually</span>
                        </span>
                        <span className="num text-paprika shrink-0">×{m.packs}</span>
                        <button type="button" onClick={() => setManual((arr) => arr.filter((_, j) => j !== i))} className={quietBtn + ' shrink-0'}>remove</button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => setTarget({ kind: 'manual' })} className={quietBtn + ' mt-3 inline-flex'}>+ add a product manually</button>
                </Section>
              )}

              {cart.probablyHave.length > 0 && (
                <Section tone="butter" icon="🫙" title="Probably in stock" count={cart.probablyHave.length} caption="Pantry staples — add any you actually need">
                  <ul className="flex flex-col divide-y divide-cream-shadow border-y border-cream-shadow">
                    {cart.probablyHave.map((item) => {
                      const added = extras.has(item.ingredientName)
                      return (
                        <li key={item.ingredientName} className="py-3 flex items-center gap-3">
                          <IngredientText item={item} />
                          {added ? (
                            <button
                              type="button"
                              onClick={() => toggle(extras, setExtras, item.ingredientName)}
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 bg-paprika text-cream hover:bg-paprika-deep transition-colors font-mono text-[0.62rem] uppercase tracking-[0.14em]"
                            >
                              ✓ buying
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                item.sku ? toggle(extras, setExtras, item.ingredientName) : setTarget({ kind: 'preference', ingredientName: item.ingredientName, addToExtras: true })
                              }
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 border border-paprika/45 text-paprika-deep hover:bg-paprika hover:text-cream transition-colors font-mono text-[0.62rem] uppercase tracking-[0.14em]"
                            >
                              + buy
                            </button>
                          )}
                          <IgnoreBtn onClick={() => ignore.mutate(item.ingredientName)} />
                        </li>
                      )
                    })}
                  </ul>
                </Section>
              )}

              {cart.unmatched.length > 0 && (
                <Section tone="neutral" icon="🔗" title="Not linked yet" count={cart.unmatched.length} caption="Pick a product (remembered) or never buy it">
                  <ul className="flex flex-col divide-y divide-cream-shadow border-y border-cream-shadow">
                    {cart.unmatched.map((item) => (
                      <li key={item.ingredientName} className="py-3 flex items-center gap-3">
                        <IngredientText item={item} />
                        <button
                          type="button"
                          onClick={() => setTarget({ kind: 'preference', ingredientName: item.ingredientName, addToExtras: false })}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg px-4 py-1.5 bg-paprika text-cream hover:bg-paprika-deep transition-colors font-mono text-[0.62rem] uppercase tracking-[0.14em]"
                        >
                          + link
                        </button>
                        <IgnoreBtn onClick={() => ignore.mutate(item.ingredientName)} />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Never-buy management */}
              {(ignoredQ.data?.length ?? 0) > 0 && (
                <div>
                  <button type="button" onClick={() => setShowIgnored((v) => !v)} className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors">
                    {showIgnored ? '▾' : '▸'} Never buy ({ignoredQ.data!.length})
                  </button>
                  {showIgnored && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {ignoredQ.data!.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() => unignore.mutate(name)}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors font-mono text-[0.62rem]"
                            title="Stop ignoring"
                          >
                            {name} <span aria-hidden>×</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {!empty && (
            <div className="fixed inset-x-0 bottom-0 z-30 px-5 sm:px-6 md:px-12 lg:px-20 pb-4 pointer-events-none">
              <div className="pointer-events-auto rounded-2xl border border-cream-shadow bg-cream/95 backdrop-blur shadow-[0_-8px_30px_-12px_rgba(20,30,18,0.25)] p-3.5 sm:p-4 flex items-center justify-between gap-4">
                <div className="font-mono text-[0.7rem] text-chestnut leading-tight">
                  <span className="num text-paprika text-base">{basketCount}</span> item{basketCount === 1 ? '' : 's'} ready
                  {cart.truncated && <span className="block text-paprika-deep text-[0.62rem]">only the first 50 fit in the link</span>}
                </div>
                <button type="button" disabled={finalItems.length === 0 || sendToStore.isPending} onClick={() => sendToStore.mutate(finalItems)} className={btnPrimary + ' shrink-0'}>
                  {sendToStore.isPending ? 'Opening…' : `Send to ${storeName} →`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <SearchProductDialog
        open={target != null}
        storeCode={storeCode}
        storeDisplayName={storeName}
        initialQuery={target?.kind === 'preference' ? target.ingredientName : ''}
        browseUrl={browseUrl}
        onClose={() => setTarget(null)}
        onPick={onPick}
      />
    </div>
  )
}

function neededLabel(item: CartItemDto): string {
  const a = formatAmount(item.amount)
  return a ? `${a} ${item.unit}`.trim() : ''
}

const TONE = {
  green: { bar: 'bg-paprika', chip: 'bg-paprika/15 text-paprika-deep' },
  butter: { bar: 'bg-butter', chip: 'bg-butter/25 text-[#7a5a12]' },
  neutral: { bar: 'bg-chestnut-soft', chip: 'bg-cream-shadow text-chestnut' },
} as const

function Section({ tone, icon, title, count, caption, children }: { tone: keyof typeof TONE; icon: string; title: string; count: number; caption: string; children: ReactNode }) {
  const t = TONE[tone]
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`w-1 h-6 rounded-full ${t.bar}`} aria-hidden />
        <span className="text-lg leading-none" aria-hidden>{icon}</span>
        <h2 className="text-ink text-xl" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</h2>
        <span className={`num text-[0.7rem] px-2 py-0.5 rounded-full ${t.chip}`}>{count}</span>
        <span className="font-mono text-[0.58rem] text-chestnut-soft truncate hidden sm:inline ml-1">{caption}</span>
      </div>
      {children}
    </motion.section>
  )
}

function IngredientText({ item }: { item: CartItemDto }) {
  const need = neededLabel(item)
  return (
    <span className="flex-1 min-w-0">
      <span className="block text-ink leading-snug truncate">{item.ingredientName}</span>
      <span className="block font-mono text-[0.58rem] text-chestnut-soft truncate">
        {need && <span className="text-chestnut">{need}</span>}
        {need && item.meals.length > 0 && ' · '}
        {item.meals.join(', ')}
      </span>
    </span>
  )
}

function IgnoreBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-chestnut-soft/70 hover:text-paprika-deep transition-colors"
      title="Never buy this — hide it from carts"
    >
      never
    </button>
  )
}

function BuyRow({ item, index, packs, excluded, onPacks, onToggleHave, onChange, onUnlink }: { item: CartItemDto; index: number; packs: number; excluded: boolean; onPacks: (v: number) => void; onToggleHave: () => void; onChange: () => void; onUnlink: () => void }) {
  const need = neededLabel(item)
  const packSize = item.packSizeAmount && item.packSizeAmount > 0 ? `${formatAmount(item.packSizeAmount)} ${item.packSizeUnit}` : null
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.35, ease }}
      className={['rounded-xl border border-cream-shadow bg-cream-deep/40 p-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-opacity', excluded ? 'opacity-45' : ''].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Thumb url={item.imageUrl} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-ink leading-tight truncate" style={{ fontWeight: 600 }}>{item.productName ?? item.ingredientName}</span>
          <span className="block font-mono text-[0.58rem] text-chestnut-soft truncate">
            {item.ingredientName}
            {need && ` · need ${need}`}
            {packSize && ` · ${packSize}`}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        {!excluded && <Stepper value={packs} onChange={onPacks} />}
        <span className="flex items-center gap-3">
          <button type="button" onClick={onToggleHave} className={quietBtn} title="I already have this">{excluded ? 'buy' : 'have it'}</button>
          <button type="button" onClick={onChange} className={quietBtn}>change</button>
          <button type="button" onClick={onUnlink} className="grid place-items-center w-6 h-6 rounded-full text-chestnut hover:bg-paprika/10 hover:text-paprika-deep transition-colors" title="Forget this product" aria-label="Forget this product">×</button>
        </span>
      </div>
    </motion.li>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Fewer" className="w-7 h-7 grid place-items-center rounded-md font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors disabled:opacity-30">−</button>
      <span className="num text-paprika text-base min-w-[1.5rem] text-center">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="More" className="w-7 h-7 grid place-items-center rounded-md font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors">+</button>
    </span>
  )
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-cream border border-cream-shadow grid place-items-center">
      {url ? <img src={url} alt="" className="w-full h-full object-contain" /> : <span aria-hidden className="text-base opacity-60">🛒</span>}
    </span>
  )
}

function CartSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-cream-shadow p-3 flex items-center gap-3">
          <span className="w-12 h-12 rounded-lg bg-cream-shadow/50 animate-pulse shrink-0" />
          <span className="flex-1 space-y-2">
            <span className="block h-4 bg-cream-shadow/50 rounded w-1/2" />
            <span className="block h-2.5 bg-cream-shadow/40 rounded w-1/3" />
          </span>
        </div>
      ))}
    </div>
  )
}
