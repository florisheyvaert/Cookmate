import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { promotionsApi } from '@/api/promotions'
import type { PromoDish, PromoUsage, PromotionDto } from '@/api/promotions'
import { PlanSuggestionDialog } from '@/components/PlanSuggestionDialog'

const STORE = 'ah'
const STORE_NAME = 'Albert Heijn'

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

export default function Promos() {
  const { isAdmin } = useAuth()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [planning, setPlanning] = useState<PromoDish | null>(null)

  const promosQ = useQuery({
    queryKey: ['promotions', STORE],
    queryFn: () => promotionsApi.list(STORE),
    staleTime: 5 * 60_000,
  })

  const selectedSkus = useMemo(() => Array.from(selected), [selected])
  const dishesQ = useQuery({
    queryKey: ['promo-dishes', STORE, selectedSkus],
    queryFn: () => promotionsApi.dishes(STORE, selectedSkus),
    enabled: (promosQ.data?.length ?? 0) > 0,
    staleTime: 60_000,
  })

  const refresh = useMutation({
    mutationFn: () => promotionsApi.refresh(STORE),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions', STORE] })
      qc.invalidateQueries({ queryKey: ['promo-dishes', STORE] })
    },
  })

  const confirm = useMutation({
    mutationFn: (u: PromoUsage) => promotionsApi.confirmMatch(STORE, u.ingredientName, u.sku),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-dishes', STORE] }),
  })

  function toggle(sku: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sku)) next.delete(sku)
      else next.add(sku)
      return next
    })
  }

  const promos = promosQ.data ?? []
  const dishes = dishesQ.data ?? []

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 py-8 sm:py-12 max-w-[1400px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-10">
        <div>
          <p className="eyebrow text-paprika mb-2.5">{STORE_NAME} · This week</p>
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
            Pick what's on promotion, see which dishes you can make with it, and plan them straight into the week.
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

      {/* ── Empty / loading states ─────────────────────────────────────────── */}
      {promosQ.isPending ? (
        <p className="eyebrow text-chestnut">Loading promotions…</p>
      ) : promos.length === 0 ? (
        <EmptyPromos isAdmin={isAdmin} onRefresh={() => refresh.mutate()} refreshing={refresh.isPending} />
      ) : (
        <>
          {/* ── Promo products ───────────────────────────────────────────────── */}
          <section className="mb-14">
            <div className="flex items-baseline justify-between gap-3 mb-5">
              <h2 className="eyebrow text-ink">
                On promotion <span className="text-chestnut-soft">· {promos.length}</span>
              </h2>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
                >
                  Clear selection ({selected.size})
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {promos.map((p) => (
                <PromoCard key={p.sku} promo={p} selected={selected.has(p.sku)} onToggle={() => toggle(p.sku)} />
              ))}
            </div>
          </section>

          {/* ── Dishes ───────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between gap-3 mb-5">
              <h2 className="eyebrow text-ink">
                Dishes you can make
                {dishes.length > 0 && <span className="text-chestnut-soft"> · {dishes.length}</span>}
              </h2>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-chestnut-soft">
                {selected.size > 0 ? `from ${selected.size} selected` : 'from all promos'}
              </p>
            </div>

            {dishesQ.isPending ? (
              <p className="eyebrow text-chestnut">Finding dishes…</p>
            ) : dishes.length === 0 ? (
              <p className="text-ink-soft text-lg leading-relaxed max-w-lg" style={{ fontFamily: 'var(--font-body)' }}>
                No matching dishes yet. Harvest more ideas, or select different promotions — the more your idea pool
                grows, the more this finds.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {dishes.map((d) => (
                  <DishCard
                    key={d.suggestionId}
                    dish={d}
                    onPlan={() => setPlanning(d)}
                    onConfirm={(u) => confirm.mutate(u)}
                    confirming={confirm.isPending}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <PlanSuggestionDialog
        open={planning != null}
        onClose={() => setPlanning(null)}
        title={planning?.title ?? ''}
        sourceUrl={planning?.sourceUrl}
        suggestionId={planning?.suggestionId}
        baseServings={planning?.baseServings}
        imageUrl={planning?.imageUrl}
      />
    </div>
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

function PromoCard({ promo, selected, onToggle }: { promo: PromotionDto; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={[
        'group text-left flex flex-col rounded-xl border overflow-hidden transition-colors bg-cream',
        selected ? 'border-paprika ring-2 ring-inset ring-paprika/40' : 'border-cream-shadow hover:border-paprika/55',
      ].join(' ')}
    >
      <span className="relative aspect-square bg-cream-deep grid place-items-center overflow-hidden">
        {promo.imageUrl ? (
          <img src={promo.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span aria-hidden className="text-2xl opacity-40">🛒</span>
        )}
        {promo.discountLabel && (
          <span className="absolute top-2 left-2 px-2 py-1 rounded-md bg-paprika text-cream font-mono text-[0.58rem] uppercase tracking-[0.08em] leading-none shadow-sm">
            {promo.discountLabel}
          </span>
        )}
        <span
          className={[
            'absolute top-2 right-2 w-5 h-5 rounded-full grid place-items-center text-[0.7rem] leading-none transition-colors',
            selected ? 'bg-paprika text-cream' : 'bg-cream/80 text-chestnut-soft group-hover:text-paprika',
          ].join(' ')}
          aria-hidden
        >
          {selected ? '✓' : '+'}
        </span>
      </span>
      <span className="flex-1 flex flex-col gap-1 px-3 py-2.5">
        <span className="font-display text-ink text-[0.92rem] leading-tight line-clamp-2" style={{ fontWeight: 600 }}>
          {promo.name}
        </span>
        {promo.packSize && (
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-chestnut-soft">{promo.packSize}</span>
        )}
        <span className="mt-auto flex items-baseline gap-1.5 pt-1">
          {promo.promoPrice != null ? (
            <>
              <span className="num text-paprika text-base">{euro.format(promo.promoPrice)}</span>
              {promo.originalPrice != null && promo.originalPrice > promo.promoPrice && (
                <span className="num text-chestnut-soft text-xs line-through">{euro.format(promo.originalPrice)}</span>
              )}
            </>
          ) : promo.originalPrice != null ? (
            <span className="num text-ink text-sm">{euro.format(promo.originalPrice)}</span>
          ) : null}
        </span>
      </span>
    </button>
  )
}

function DishCard({
  dish,
  onPlan,
  onConfirm,
  confirming,
}: {
  dish: PromoDish
  onPlan: () => void
  onConfirm: (u: PromoUsage) => void
  confirming: boolean
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-cream-shadow overflow-hidden bg-cream">
      <div className="flex gap-4 p-4">
        <span className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-cream-shadow bg-cream-deep grid place-items-center">
          {dish.imageUrl ? (
            <img src={dish.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden className="text-xl opacity-40">🍽️</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-ink leading-tight line-clamp-2" style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.05rem' }}>
            {dish.title}
          </h3>
          <p className="mt-1.5 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-chestnut-soft">
            <span className="text-paprika">
              {dish.matchedIngredientCount}/{dish.relevantIngredientCount} on promo
            </span>
            {dish.totalTimeMinutes != null && <span>· {dish.totalTimeMinutes} min</span>}
          </p>
        </div>
      </div>

      {/* Used promos — confirmed (filled) vs suggested (outline, tap to confirm) */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {dish.usedPromos.map((u) =>
          u.confirmed ? (
            <span
              key={u.sku}
              title={`Linked: ${u.ingredientName} → ${u.name}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-paprika/12 text-paprika font-mono text-[0.58rem] uppercase tracking-[0.06em] leading-none"
            >
              <span aria-hidden>✓</span> {u.name}
            </span>
          ) : (
            <button
              key={u.sku}
              type="button"
              onClick={() => onConfirm(u)}
              disabled={confirming || !u.ingredientName}
              title={`Confirm: ${u.ingredientName} → ${u.name}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-cream-shadow text-chestnut font-mono text-[0.58rem] uppercase tracking-[0.06em] leading-none hover:border-paprika hover:text-paprika transition-colors disabled:opacity-50"
            >
              <span aria-hidden>+</span> {u.name}
            </button>
          ),
        )}
      </div>

      <footer className="mt-auto px-4 py-3 border-t border-cream-shadow flex items-center justify-between gap-3">
        <a
          href={dish.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-chestnut hover:text-paprika transition-colors"
        >
          Recipe ↗
        </a>
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={onPlan}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 bg-paprika text-cream font-display font-semibold text-[0.85rem] hover:bg-paprika-deep transition-colors"
        >
          Add to plan <span aria-hidden>→</span>
        </motion.button>
      </footer>
    </article>
  )
}
