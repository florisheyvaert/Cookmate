import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import { shoppingApi } from '@/api/shopping'
import type { ShoppingDeeplinkResultDto } from '@/api/shopping'
import type { RecipeSummaryDto } from '@/api/types'
import { ApiError } from '@/lib/api'
import { btnPrimary } from '@/lib/ui'
import { PageHeader } from '@/components/PageHeader'

const ease = [0.22, 1, 0.36, 1] as const

type Selection = { recipeId: number; servings: number }

export default function Shop() {
  const [storeCode, setStoreCode] = useState('ah')
  const [selections, setSelections] = useState<Selection[]>([])
  const [preview, setPreview] = useState<ShoppingDeeplinkResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stores = useQuery({
    queryKey: ['shop', 'stores'],
    queryFn: () => shoppingApi.listStores(),
    staleTime: Infinity,
  })

  const recipes = useQuery({
    queryKey: ['recipes', 'all-for-shop'],
    queryFn: () => recipesApi.list(),
  })

  const buildPreview = useMutation({
    mutationFn: () =>
      shoppingApi.buildListDeeplink(
        storeCode,
        selections.map((s) => ({ recipeId: s.recipeId, servings: s.servings })),
      ),
    onSuccess: (result) => {
      setError(null)
      setPreview(result)
    },
    onError: (err) => setError(extractError(err)),
  })

  const selectionsById = useMemo(
    () => new Map(selections.map((s) => [s.recipeId, s])),
    [selections],
  )

  function toggle(recipe: RecipeSummaryDto) {
    setSelections((prev) => {
      const existing = prev.find((s) => s.recipeId === recipe.id)
      if (existing) return prev.filter((s) => s.recipeId !== recipe.id)
      return [...prev, { recipeId: recipe.id, servings: recipe.baseServings }]
    })
    setPreview(null)
  }

  function setServings(recipeId: number, servings: number) {
    setSelections((prev) =>
      prev.map((s) => (s.recipeId === recipeId ? { ...s, servings: Math.max(1, servings) } : s)),
    )
    setPreview(null)
  }

  function openDeeplink() {
    if (!preview?.deeplink) return
    window.open(preview.deeplink, '_blank', 'noopener')
  }

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-16 grain min-h-[80vh]">
      <PageHeader
        eyebrow="Cookbook · Shop"
        title="Pick your week."
        subtitle="Tick the recipes you'll cook, set the servings, and consolidate everything into a single Albert Heijn list."
      />

      {stores.data && stores.data.length > 1 && (
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-chestnut">
            Store
          </span>
          {stores.data.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => {
                setStoreCode(s.code)
                setPreview(null)
              }}
              className={[
                'font-mono text-[0.7rem] uppercase tracking-[0.18em] px-2.5 py-1 border rounded-sm transition-colors',
                s.code === storeCode
                  ? 'bg-paprika text-cream border-paprika'
                  : 'text-chestnut border-cream-shadow hover:border-paprika hover:text-paprika',
              ].join(' ')}
            >
              {s.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-10">
        <section className="lg:col-span-7">
          <header className="flex items-baseline gap-3 mb-4">
            <p className="eyebrow">Recipes</p>
            <span className="num text-chestnut-soft text-[0.78rem]">
              {String(selections.length).padStart(2, '0')}/{String(recipes.data?.length ?? 0).padStart(2, '0')}
            </span>
          </header>

          {recipes.isPending ? (
            <p className="eyebrow">Loading the cookbook…</p>
          ) : recipes.isError ? (
            <p className="font-mono text-[0.72rem] text-paprika-deep">Couldn't load recipes.</p>
          ) : recipes.data.length === 0 ? (
            <p className="text-chestnut italic">No recipes yet — add one first.</p>
          ) : (
            <ul className="divide-y divide-cream-shadow">
              {recipes.data.map((r, i) => {
                const sel = selectionsById.get(r.id)
                const checked = sel != null
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * i, duration: 0.25, ease }}
                    className="py-3 flex items-center gap-3 flex-wrap"
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(r)}
                        className="accent-paprika w-4 h-4 shrink-0"
                      />
                      <span
                        className="font-display text-ink text-lg truncate"
                        style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                      >
                        {r.title}
                      </span>
                    </label>
                    {checked && sel && (
                      <ServingsStepper
                        value={sel.servings}
                        baseServings={r.baseServings}
                        onChange={(v) => setServings(r.id, v)}
                      />
                    )}
                    <Link
                      to={`/recipes/${r.id}`}
                      className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors no-underline"
                    >
                      view →
                    </Link>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="lg:col-span-5 lg:border-l lg:border-cream-shadow lg:pl-10">
          <header className="flex items-baseline gap-3 mb-4">
            <p className="eyebrow text-paprika">Basket</p>
            <span className="num text-chestnut-soft text-[0.78rem]">
              {String(preview?.mapped.length ?? 0).padStart(2, '0')}
            </span>
          </header>

          {selections.length === 0 ? (
            <p className="text-chestnut italic">Pick at least one recipe to start.</p>
          ) : !preview ? (
            <button
              type="button"
              onClick={() => buildPreview.mutate()}
              disabled={buildPreview.isPending}
              className={btnPrimary}
            >
              {buildPreview.isPending ? 'Consolidating…' : 'Preview basket'}
              <span aria-hidden>→</span>
            </button>
          ) : (
            <PreviewPanel
              preview={preview}
              onRecompute={() => buildPreview.mutate()}
              onSend={openDeeplink}
            />
          )}

          {error && (
            <p className="mt-4 font-mono text-[0.7rem] text-paprika-deep">{error}</p>
          )}
        </aside>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ServingsStepper({
  value,
  baseServings,
  onChange,
}: {
  value: number
  baseServings: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Fewer servings"
        className="w-6 h-6 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors disabled:opacity-30"
      >
        −
      </button>
      <span
        className="num text-paprika text-base min-w-[1.5rem] text-center"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="More servings"
        className="w-6 h-6 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors"
      >
        +
      </button>
      {value !== baseServings && (
        <button
          type="button"
          onClick={() => onChange(baseServings)}
          className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-chestnut-soft hover:text-paprika transition-colors"
        >
          ↺ {baseServings}
        </button>
      )}
    </div>
  )
}

function PreviewPanel({
  preview,
  onRecompute,
  onSend,
}: {
  preview: ShoppingDeeplinkResultDto
  onRecompute: () => void
  onSend: () => void
}) {
  return (
    <div className="space-y-5">
      {preview.mapped.length > 0 && (
        <ul className="divide-y divide-cream-shadow">
          {preview.mapped.map((m) => (
            <li key={m.sku} className="py-2 flex items-center gap-3">
              <span className="w-10 h-10 shrink-0 bg-cream-deep/50 border border-cream-shadow rounded-sm overflow-hidden flex items-center justify-center">
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="font-mono text-[0.6rem] text-chestnut-soft">no img</span>
                )}
              </span>
              <span
                className="flex-1 min-w-0 font-display text-ink truncate"
                style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
              >
                {m.productName}
              </span>
              <span
                className="num text-paprika text-base shrink-0"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                ×{m.packs}
              </span>
            </li>
          ))}
        </ul>
      )}

      {preview.unmapped.length > 0 && (
        <div className="border-l-2 border-paprika/40 pl-3">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-paprika-deep mb-1">
            Skipped — needs mapping
          </p>
          <ul className="font-mono text-[0.7rem] text-chestnut-soft space-y-0.5">
            {preview.unmapped.map((u, i) => (
              <li key={`${u.ingredientId}-${i}`}>
                {u.name} <Link
                  to={`/recipes/${u.recipeId}`}
                  className="text-paprika no-underline hover:underline"
                >
                  → map
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-2">
        {preview.deeplink ? (
          <button
            type="button"
            onClick={onSend}
            className={btnPrimary}
          >
            Send to {preview.storeDisplayName}
            <span aria-hidden>→</span>
          </button>
        ) : (
          <p className="font-mono text-[0.7rem] text-chestnut-soft">
            Map at least one ingredient to send a list.
          </p>
        )}
        <button
          type="button"
          onClick={onRecompute}
          className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors"
        >
          Recompute
        </button>
      </div>

      {preview.truncated && (
        <p className="font-mono text-[0.66rem] text-paprika-deep">
          Too many items — only the first 50 fit in the link.
        </p>
      )}
    </div>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: string; title?: string } | null
    return body?.detail ?? body?.title ?? `Request failed (HTTP ${err.status}).`
  }
  return 'Something went wrong.'
}
