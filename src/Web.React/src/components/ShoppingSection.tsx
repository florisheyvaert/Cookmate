import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { shoppingApi } from '@/api/shopping'
import type {
  GroceryProductCandidateDto,
  GroceryStoreDto,
  ShoppingDeeplinkResultDto,
} from '@/api/shopping'
import type { IngredientStoreLinkDto, RecipeDto, RecipeIngredientDto } from '@/api/types'
import { btnPrimarySm } from '@/lib/ui'
import { ApiError } from '@/lib/api'
import { SearchProductDialog } from '@/components/SearchProductDialog'

const ease = [0.22, 1, 0.36, 1] as const

const STORE_BROWSE_URLS: Record<string, string> = {
  ah: 'https://www.ah.be/zoeken?query=',
}

type ShoppingSectionProps = {
  recipe: RecipeDto
  servings: number
}

/**
 * "III. Shopping" — every ingredient listed once with the products it's
 * been linked to (at any store, possibly multiple). Shoppers can add,
 * unlink, and send a per-store basket from here.
 */
export function ShoppingSection({ recipe, servings }: ShoppingSectionProps) {
  const stores = useQuery({
    queryKey: ['shop', 'stores'],
    queryFn: () => shoppingApi.listStores(),
    staleTime: Infinity,
  })

  const sorted = useMemo(
    () =>
      [...recipe.ingredients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [recipe.ingredients],
  )

  // Stores that the recipe currently has at least one link for — show one
  // "Send to {store} →" CTA per such store. Order follows the listStores
  // response so AH stays primary.
  const usedStoreCodes = useMemo(() => {
    const set = new Set<string>()
    for (const ing of recipe.ingredients) {
      for (const link of ing.storeLinks) set.add(link.storeCode)
    }
    return set
  }, [recipe.ingredients])

  return (
    <section className="col-span-12 mt-8 lg:mt-0">
      <div className="flex items-baseline gap-3 border-b border-chestnut/30 pb-3">
        <span
          className="font-display text-paprika text-2xl leading-none"
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 30, "WONK" 1' }}
        >
          III.
        </span>
        <h2
          className="font-display text-ink text-2xl"
          style={{
            fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
            letterSpacing: '-0.015em',
          }}
        >
          Shopping
        </h2>
        <span className="ml-auto font-mono text-[0.7rem] tracking-tight text-chestnut-soft">
          {countMapped(recipe)}/{recipe.ingredients.length}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-6 text-chestnut italic">No ingredients to shop for yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-cream-shadow">
          {sorted.map((ing, i) => (
            <ShoppingRow
              key={ing.id}
              index={i + 1}
              recipeId={recipe.id}
              ingredient={ing}
              stores={stores.data ?? []}
            />
          ))}
        </ul>
      )}

      {stores.data && stores.data.length > 0 && (
        <SendBar
          recipeId={recipe.id}
          servings={servings}
          stores={stores.data.filter((s) => usedStoreCodes.has(s.code))}
        />
      )}
    </section>
  )
}

function countMapped(recipe: RecipeDto): number {
  return recipe.ingredients.filter((i) => i.storeLinks.length > 0).length
}

// ─── Per-ingredient row ──────────────────────────────────────────────────────

function ShoppingRow({
  index,
  recipeId,
  ingredient,
  stores,
}: {
  index: number
  recipeId: number
  ingredient: RecipeIngredientDto
  stores: GroceryStoreDto[]
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.015 * index, duration: 0.3, ease }}
      className="grid grid-cols-1 md:grid-cols-[3rem_minmax(0,14rem)_1fr] gap-x-6 gap-y-2 py-4"
    >
      <span
        className="num text-paprika text-xl md:text-2xl leading-none select-none self-baseline"
        style={{
          fontFamily: 'var(--font-display)',
          fontVariationSettings: '"opsz" 96, "SOFT" 30, "WONK" 1',
          letterSpacing: '-0.03em',
        }}
      >
        {String(index).padStart(2, '0')}
      </span>

      <div className="min-w-0 self-baseline">
        <p
          className="font-display text-ink leading-snug text-base md:text-lg break-words"
          style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
        >
          {ingredient.name}
        </p>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-chestnut-soft mt-0.5">
          {formatAmountUnit(ingredient.amount, ingredient.unit)}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-2 min-w-0">
        <AnimatePresence initial={false}>
          {ingredient.storeLinks.map((link) => (
            <motion.div
              key={link.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease }}
            >
              <ProductChip recipeId={recipeId} link={link} />
            </motion.div>
          ))}
        </AnimatePresence>
        {ingredient.storeLinks.length === 0 && (
          <span aria-hidden className="font-mono text-chestnut-soft text-sm pt-1">
            —
          </span>
        )}
        <AddProductAffordance recipeId={recipeId} ingredient={ingredient} stores={stores} />
      </div>
    </motion.li>
  )
}

// ─── Linked product chip ─────────────────────────────────────────────────────

function ProductChip({
  recipeId,
  link,
}: {
  recipeId: number
  link: IngredientStoreLinkDto
}) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const unlink = useMutation({
    mutationFn: () => shoppingApi.unlink(link.id),
    onSuccess: () => {
      setError(null)
      qc.invalidateQueries({ queryKey: ['recipe', recipeId] })
      qc.invalidateQueries({ queryKey: ['shop', 'recipe', recipeId] })
    },
    onError: (err) => setError(extractError(err)),
  })

  const productHref = link.canonicalUrl ?? null
  const meta = [
    link.brandOrSubtitle,
    link.packSizeAmount > 0
      ? `${formatAmount(link.packSizeAmount)} ${link.packSizeUnit}`
      : null,
    link.unitPrice != null ? `€${link.unitPrice.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="group relative grain rounded-sm border border-paprika/40 bg-paprika-tint/60 px-2.5 py-2 flex items-center gap-2.5 max-w-[20rem]">
      <span className="w-9 h-9 shrink-0 bg-cream/70 border border-cream-shadow rounded-sm overflow-hidden flex items-center justify-center">
        {link.imageUrl ? (
          <img src={link.imageUrl} alt="" className="w-full h-full object-contain" />
        ) : (
          <span className="font-mono text-[0.55rem] text-chestnut-soft">no img</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-paprika-deep"
        >
          {link.storeCode.toUpperCase()}
        </p>
        {productHref ? (
          <a
            href={productHref}
            target="_blank"
            rel="noreferrer"
            title={link.productName}
            className="block font-display text-ink text-sm truncate no-underline hover:text-paprika transition-colors"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
          >
            {link.productName}
          </a>
        ) : (
          <p
            title={link.productName}
            className="font-display text-ink text-sm truncate"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
          >
            {link.productName}
          </p>
        )}
        {meta && (
          <p className="font-mono text-[0.6rem] text-chestnut truncate">{meta}</p>
        )}
        {error && (
          <p className="font-mono text-[0.6rem] text-paprika-deep mt-0.5">{error}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => unlink.mutate()}
        disabled={unlink.isPending}
        aria-label="Remove this product"
        className="self-start w-5 h-5 flex items-center justify-center text-paprika-deep hover:bg-paprika hover:text-cream rounded-sm transition-colors disabled:opacity-50 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        ×
      </button>
    </div>
  )
}

// ─── "+ Add product" affordance ─────────────────────────────────────────────

function AddProductAffordance({
  recipeId,
  ingredient,
  stores,
}: {
  recipeId: number
  ingredient: RecipeIngredientDto
  stores: GroceryStoreDto[]
}) {
  const qc = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchStore, setSearchStore] = useState<GroceryStoreDto | null>(null)

  const linkBySku = useMutation({
    mutationFn: ({ storeCode, sku }: { storeCode: string; sku: string }) =>
      shoppingApi.linkIngredient({
        ingredientId: ingredient.id,
        storeCode,
        sku,
        defaultPackQuantity: 1,
      }),
    onSuccess: () => {
      setSearchStore(null)
      qc.invalidateQueries({ queryKey: ['recipe', recipeId] })
      qc.invalidateQueries({ queryKey: ['shop', 'recipe', recipeId] })
    },
  })

  function chooseStore(store: GroceryStoreDto) {
    setPickerOpen(false)
    setSearchStore(store)
  }

  function buttonLabel(): string {
    if (stores.length === 1) return `+ ${stores[0].displayName}`
    return ingredient.storeLinks.length > 0 ? '+ another' : '+ link product'
  }

  function handleAddClick() {
    if (stores.length === 0) return
    if (stores.length === 1) {
      setSearchStore(stores[0])
    } else {
      setPickerOpen((v) => !v)
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={handleAddClick}
          className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors px-2 py-1.5 border border-dashed border-chestnut/40 hover:border-paprika rounded-sm"
        >
          {buttonLabel()}
        </button>

        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15, ease }}
              className="absolute left-0 top-full mt-1 z-20 bg-cream border border-chestnut/30 shadow-[0_12px_32px_-8px_rgba(26,20,16,0.35)] rounded-sm py-1 min-w-[12rem]"
              role="menu"
            >
              {stores.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => chooseStore(s)}
                  role="menuitem"
                  className="w-full text-left px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-chestnut hover:bg-paprika-tint hover:text-paprika transition-colors"
                >
                  {s.displayName}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {searchStore && (
        <SearchProductDialog
          open={true}
          storeCode={searchStore.code}
          storeDisplayName={searchStore.displayName}
          initialQuery={ingredient.name}
          browseUrl={
            (STORE_BROWSE_URLS[searchStore.code] ?? '') + encodeURIComponent(ingredient.name)
          }
          onClose={() => setSearchStore(null)}
          onPick={(c: GroceryProductCandidateDto) =>
            linkBySku.mutate({ storeCode: searchStore.code, sku: c.sku })
          }
        />
      )}

    </>
  )
}

// ─── Bottom send bar ─────────────────────────────────────────────────────────

function SendBar({
  recipeId,
  servings,
  stores,
}: {
  recipeId: number
  servings: number
  stores: GroceryStoreDto[]
}) {
  if (stores.length === 0) return null

  return (
    <div className="mt-10 pt-5 border-t border-cream-shadow flex items-center gap-3 flex-wrap">
      <span className="eyebrow mr-1">Send basket</span>
      {stores.map((store) => (
        <SendStoreButton
          key={store.code}
          recipeId={recipeId}
          servings={servings}
          store={store}
        />
      ))}
    </div>
  )
}

function SendStoreButton({
  recipeId,
  servings,
  store,
}: {
  recipeId: number
  servings: number
  store: GroceryStoreDto
}) {
  const data = useQuery<ShoppingDeeplinkResultDto>({
    queryKey: ['shop', 'recipe', recipeId, store.code, servings],
    queryFn: () => shoppingApi.buildRecipeDeeplink(recipeId, store.code, servings),
  })

  const url = data.data?.deeplink ?? null

  function send() {
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={!url}
      className={btnPrimarySm}
    >
      Send to {store.displayName}
      <span aria-hidden>→</span>
    </button>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (n === Math.trunc(n)) return n.toString()
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function formatAmountUnit(amount: number, unit: string): string {
  const a = amount > 0 ? formatAmount(amount) : '—'
  return `${a}${unit ? ' ' + unit : ''}`
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: string; title?: string } | null
    return body?.detail ?? body?.title ?? `Failed (HTTP ${err.status}).`
  }
  return 'Something went wrong.'
}
