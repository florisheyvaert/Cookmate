import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { promotionsApi } from '@/api/promotions'
import type { PromoDish, PromoUsage } from '@/api/promotions'
import { PlanSuggestionDialog } from '@/components/PlanSuggestionDialog'

const STORE = 'ah'

export default function PromoMeals() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const week = params.get('week')
  const skus = useMemo(() => (params.get('skus') ?? '').split(',').filter(Boolean), [params])
  const [planning, setPlanning] = useState<PromoDish | null>(null)

  const dishesQ = useQuery({
    queryKey: ['promo-dishes', STORE, week, skus],
    queryFn: () => promotionsApi.dishes(STORE, skus, week, 100),
    enabled: skus.length > 0,
    staleTime: 60_000,
  })

  const confirm = useMutation({
    mutationFn: (u: PromoUsage) => promotionsApi.confirmMatch(STORE, u.ingredientName, u.sku),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-dishes', STORE] }),
  })

  const dishes = dishesQ.data ?? []
  // Back to the promo browser with the same week + selection intact.
  const backTo = `/promos?${params.toString()}`

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 py-8 sm:py-12 max-w-[1300px] mx-auto">
      <header className="mb-8 sm:mb-10">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors mb-5"
        >
          <span aria-hidden>←</span> Promos
        </Link>
        <p className="eyebrow text-paprika mb-2.5">
          {skus.length} promo{skus.length === 1 ? '' : 's'} selected
        </p>
        <h1
          className="font-display text-ink"
          style={{ fontSize: 'clamp(2.2rem, 5.5vw, 3.4rem)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.035em' }}
        >
          Meals you can{' '}
          <span className="italic" style={{ fontFamily: 'var(--font-body)', color: 'var(--color-paprika)' }}>
            make
          </span>
          .
        </h1>
      </header>

      {skus.length === 0 ? (
        <p className="text-ink-soft text-lg leading-relaxed max-w-lg" style={{ fontFamily: 'var(--font-body)' }}>
          No promotions selected.{' '}
          <Link to="/promos" className="text-paprika underline underline-offset-2">
            Go back and pick some
          </Link>
          .
        </p>
      ) : dishesQ.isPending ? (
        <p className="eyebrow text-chestnut">Finding meals…</p>
      ) : dishes.length === 0 ? (
        <p className="text-ink-soft text-lg leading-relaxed max-w-lg" style={{ fontFamily: 'var(--font-body)' }}>
          No matching meals yet. Pick different promotions, or harvest more ideas — the richer your idea pool, the more
          this finds.
        </p>
      ) : (
        <>
          <h2 className="eyebrow text-ink mb-5">
            {dishes.length} meal{dishes.length === 1 ? '' : 's'}
          </h2>
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
          <h3
            className="font-display text-ink leading-tight line-clamp-2"
            style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.05rem' }}
          >
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

      {/* Used promos — confirmed (filled), suggested (tap to confirm), or combi tile (static). */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {dish.usedPromos.map((u) => {
          if (u.confirmed) {
            return (
              <span
                key={u.sku}
                title={`Linked: ${u.ingredientName} → ${u.name}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-paprika/12 text-paprika font-mono text-[0.58rem] uppercase tracking-[0.06em] leading-none"
              >
                <span aria-hidden>✓</span> {u.name}
              </span>
            )
          }
          if (!u.linkable) {
            return (
              <span
                key={u.sku}
                title={u.discountLabel ? `${u.name} · ${u.discountLabel}` : u.name}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-cream-shadow text-chestnut-soft font-mono text-[0.58rem] uppercase tracking-[0.06em] leading-none"
              >
                {u.name}
              </span>
            )
          }
          return (
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
          )
        })}
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
