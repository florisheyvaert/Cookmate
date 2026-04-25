import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import { ApiError } from '@/lib/api'
import { formatAmount, formatDuration, formatHostname } from '@/lib/format'
import { MediaCarousel } from '@/components/MediaCarousel'
import { MiseLine } from '@/components/MiseLine'
import { findStepIngredients } from '@/lib/stepIngredients'
import type { RecipeDto, RecipeIngredientDto, RecipeStepDto } from '@/api/types'

const ease = [0.22, 1, 0.36, 1] as const

export default function RecipeDetail() {
  const { id: idParam } = useParams<{ id: string }>()
  const id = Number(idParam)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedServings = Number(searchParams.get('servings')) || undefined

  // Fetch the recipe once at base servings — scaling is pure math, no need to refetch on every step.
  const query = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  function setServings(next: number) {
    if (next < 1) return
    if (!query.data) return
    if (next === query.data.baseServings) {
      searchParams.delete('servings')
    } else {
      searchParams.set('servings', String(next))
    }
    setSearchParams(searchParams, { replace: true })
  }

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) return <DetailError error={query.error} />

  const recipe = query.data
  const targetServings = requestedServings ?? recipe.baseServings
  const scaleFactor = targetServings / recipe.baseServings
  const sourceHost = formatHostname(recipe.sourceUrl)
  const time = formatDuration(recipe.totalTimeMinutes)
  const heroImage = recipe.media.find((m) => m.type === 1) ?? null

  return (
    <article className="overflow-x-hidden">
      <TopBar recipeId={recipe.id} />

      {heroImage ? (
        <FullBleedHero
          image={heroImage}
          title={recipe.title}
          sourceHost={sourceHost}
          sourceUrl={recipe.sourceUrl}
          cookHref={`/recipes/${recipe.id}/cook${requestedServings ? `?servings=${requestedServings}` : ''}`}
        />
      ) : (
        <PlainHeader
          recipe={recipe}
          sourceHost={sourceHost}
          cookHref={`/recipes/${recipe.id}/cook${requestedServings ? `?servings=${requestedServings}` : ''}`}
        />
      )}

      <div className="px-6 md:px-12 lg:px-20 pt-12 pb-12 grain">
        <MetaStrip
          time={time}
          tags={recipe.tags}
          servings={targetServings}
          baseServings={recipe.baseServings}
          onServingsChange={setServings}
        />

        {recipe.summary && <Summary>{recipe.summary}</Summary>}

        <Ornament />

        {/* Block stack on mobile (grid gaps × 11 would otherwise exceed the viewport
            and force the col-span-12 children wider than the screen). Only switch
            to the 12-col grid from lg. */}
        <div className="space-y-14 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-x-10 lg:gap-y-16">
          <Ingredients ingredients={recipe.ingredients} factor={scaleFactor} />
          <Method
            steps={recipe.steps}
            ingredients={recipe.ingredients}
            factor={scaleFactor}
          />
        </div>

      </div>

      <MediaCarousel recipeId={recipe.id} media={recipe.media} />
    </article>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function TopBar({ recipeId }: { recipeId: number }) {
  return (
    <div className="px-6 md:px-12 lg:px-20 pt-4 flex items-baseline gap-3 flex-wrap">
      <Link
        to="/recipes"
        className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors no-underline"
      >
        ← All recipes
      </Link>
      <span className="ml-auto" />
      <Link
        to={`/recipes/${recipeId}/edit`}
        className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors no-underline"
      >
        Edit
      </Link>
    </div>
  )
}

function CookCta({ href }: { href: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.6, ease }}
      className="absolute right-4 md:right-12 lg:right-20 bottom-4 md:bottom-12 z-10"
    >
      <Link
        to={href}
        aria-label="Start cooking"
        className="group inline-flex items-center gap-1.5 md:gap-3 px-3 md:px-7 py-2 md:py-4 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.62rem] md:text-[0.78rem] no-underline shadow-[0_8px_24px_-8px_rgba(26,20,16,0.45)] hover:bg-paprika transition-colors"
      >
        <span aria-hidden className="text-paprika group-hover:text-cream transition-colors">▷</span>
        <span className="hidden md:inline">Start cooking</span>
        <span className="md:hidden">Cook</span>
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    </motion.div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

type FullBleedHeroProps = {
  image: { url: string; caption: string | null }
  title: string
  sourceHost: string | null
  sourceUrl: string | null
  cookHref: string
}

function FullBleedHero({ image, title, sourceHost, sourceUrl, cookHref }: FullBleedHeroProps) {
  return (
    <header className="relative mt-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease }}
        className="aspect-[16/10] md:aspect-[21/9] w-full bg-ink"
        style={{
          backgroundImage: `url(${image.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 md:px-12 lg:px-20 pb-8 md:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8, ease }}
            className="max-w-5xl"
          >
            {sourceHost && sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="eyebrow text-paprika hover:underline no-underline mb-3 inline-block"
              >
                From {sourceHost}
              </a>
            ) : (
              <p className="eyebrow text-paprika mb-3">From the kitchen</p>
            )}
            <h1
              className="font-display text-ink max-w-[calc(100%-6rem)] md:max-w-[calc(100%-13rem)]"
              style={{
                fontSize: 'clamp(2.6rem, 7vw, 6rem)',
                lineHeight: 0.92,
                letterSpacing: '-0.035em',
                fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
              }}
            >
              {title}
            </h1>
          </motion.div>
        </div>
        <CookCta href={cookHref} />
      </motion.div>
    </header>
  )
}

function PlainHeader({
  recipe,
  sourceHost,
  cookHref,
}: {
  recipe: RecipeDto
  sourceHost: string | null
  cookHref: string
}) {
  // Mirror the hero's footprint so the page rhythm stays the same with or without a photo.
  return (
    <header className="relative mt-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease }}
        className="relative aspect-[16/10] md:aspect-[21/9] w-full grain"
        style={{
          background:
            'radial-gradient(120% 80% at 18% 30%, rgba(232,90,26,0.10), transparent 55%),' +
            'radial-gradient(80% 60% at 85% 80%, rgba(123,94,63,0.10), transparent 60%),' +
            'linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream) 100%)',
        }}
      >
        <span
          aria-hidden
          className="absolute right-[-3vw] top-1/2 -translate-y-1/2 select-none text-paprika/15 leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(14rem, 28vw, 32rem)',
            fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
            letterSpacing: '-0.05em',
          }}
        >
          ❦
        </span>

        <div className="absolute inset-x-0 bottom-0 px-6 md:px-12 lg:px-20 pb-8 md:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease }}
            className="max-w-5xl"
          >
            {sourceHost && recipe.sourceUrl ? (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="eyebrow text-paprika hover:underline no-underline mb-3 inline-block"
              >
                From {sourceHost}
              </a>
            ) : (
              <p className="eyebrow text-paprika mb-3">From the kitchen</p>
            )}
            <h1
              className="font-display text-ink max-w-[calc(100%-6rem)] md:max-w-[calc(100%-13rem)]"
              style={{
                fontSize: 'clamp(2.6rem, 7vw, 6rem)',
                lineHeight: 0.92,
                letterSpacing: '-0.035em',
                fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
              }}
            >
              {recipe.title}
            </h1>
          </motion.div>
        </div>
        <CookCta href={cookHref} />
      </motion.div>
    </header>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

type MetaStripProps = {
  time: string | null
  tags: string[]
  servings: number
  baseServings: number
  onServingsChange: (n: number) => void
}

function MetaStrip({ time, tags, servings, baseServings, onServingsChange }: MetaStripProps) {
  const isScaled = servings !== baseServings
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="grid grid-cols-12 gap-y-6 gap-x-6 items-baseline pb-8 border-b border-cream-shadow"
    >
      <div className="col-span-6 md:col-span-3">
        <p className="eyebrow mb-1.5">Serves</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onServingsChange(servings - 1)}
            disabled={servings <= 1}
            aria-label="Fewer servings"
            className="w-7 h-7 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-paprika"
          >
            −
          </button>
          <span className="num text-paprika text-3xl min-w-[2ch] text-center" style={{ fontFeatureSettings: '"tnum"' }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={servings}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease }}
                className="inline-block"
              >
                {servings}
              </motion.span>
            </AnimatePresence>
          </span>
          <button
            type="button"
            onClick={() => onServingsChange(servings + 1)}
            aria-label="More servings"
            className="w-7 h-7 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors"
          >
            +
          </button>
          {isScaled && (
            <button
              type="button"
              onClick={() => onServingsChange(baseServings)}
              className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut-soft hover:text-paprika transition-colors"
            >
              ↺ {baseServings}
            </button>
          )}
        </div>
      </div>

      <div className="col-span-6 md:col-span-3">
        <p className="eyebrow mb-1.5">Time</p>
        <p className="num text-paprika text-3xl">{time ?? <span className="text-chestnut-soft text-2xl">—</span>}</p>
      </div>

      <div className="col-span-12 md:col-span-6">
        <p className="eyebrow mb-1.5">Tags</p>
        {tags.length === 0 ? (
          <p className="font-mono text-sm text-chestnut-soft">untagged</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link
                key={t}
                to={`/recipes?tag=${encodeURIComponent(t)}`}
                className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors no-underline border border-cream-shadow hover:border-paprika px-2.5 py-1 rounded-sm"
              >
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function Summary({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.6 }}
      className="dropcap font-display text-ink-soft mt-12 max-w-3xl text-xl md:text-2xl"
      style={{
        lineHeight: 1.5,
        fontVariationSettings: '"opsz" 36, "SOFT" 50, "WONK" 0',
      }}
    >
      {children}
    </motion.p>
  )
}

function Ornament() {
  return (
    <div className="flex items-center gap-6 my-16 max-w-3xl mx-auto" aria-hidden>
      <span className="flex-1 h-px bg-cream-shadow" />
      <span
        className="text-paprika text-2xl font-display leading-none"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
      >
        ❦
      </span>
      <span className="flex-1 h-px bg-cream-shadow" />
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function Ingredients({
  ingredients,
  factor,
}: {
  ingredients: RecipeIngredientDto[]
  factor: number
}) {
  // Sort A-Z so the same ingredient lives in the same place across recipes (locale-aware).
  const sorted = [...ingredients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )

  return (
    <section className="col-span-12 lg:col-span-5">
      <SectionMark numeral="I">Ingredients</SectionMark>

      {sorted.length === 0 ? (
        <p className="text-chestnut italic">No ingredients yet.</p>
      ) : (
        <ul className="mt-6 space-y-3.5">
          {sorted.map((ing, i) => {
            const scaled = ing.amount * factor
            const hasAmount = scaled > 0
            const display = hasAmount ? formatAmount(scaled) : ''
            return (
            <motion.li
              key={ing.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.4, duration: 0.4, ease }}
              className="grid grid-cols-[4.5rem_2.5rem_1fr] items-baseline gap-x-3"
            >
              <span
                className="num text-paprika text-base text-right tabular-nums"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={display}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2, ease }}
                    className="inline-block"
                  >
                    {display}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut-soft">
                {hasAmount ? ing.unit || '' : ''}
              </span>
              <span className="min-w-0 break-words">
                <span
                  className="font-display text-ink leading-snug text-lg"
                  style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                >
                  {ing.name}
                </span>
                {ing.notes && (
                  <span className="text-chestnut text-sm italic ml-2">— {ing.notes}</span>
                )}
              </span>
            </motion.li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Method({
  steps,
  ingredients,
  factor,
}: {
  steps: RecipeStepDto[]
  ingredients: RecipeIngredientDto[]
  factor: number
}) {
  return (
    <section className="col-span-12 lg:col-span-7">
      <SectionMark numeral="II">Method</SectionMark>

      {steps.length === 0 ? (
        <p className="text-chestnut italic mt-6">No steps yet.</p>
      ) : (
        <ol className="mt-6 md:mt-8 space-y-9 md:space-y-12">
          {steps.map((step, i) => {
            const stepIngs = findStepIngredients(step.instruction, ingredients)
            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i + 0.5, duration: 0.5, ease }}
                className="group space-y-2 md:space-y-0 md:grid md:grid-cols-[5rem_1fr] md:gap-x-5 relative"
              >
                <span className="eyebrow text-paprika md:hidden flex items-center gap-3 before:content-[''] before:flex-1 before:max-w-[2.5rem] before:h-px before:bg-paprika/40 after:content-[''] after:flex-1 after:h-px after:bg-paprika/20">
                  Step {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="num text-paprika leading-none text-6xl text-right select-none transition-opacity group-hover:opacity-100 opacity-70 hidden md:block"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
                    letterSpacing: '-0.04em',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  {stepIngs.length > 0 && (
                    <MiseLine ingredients={stepIngs} factor={factor} />
                  )}
                  <p
                    className="font-display text-ink-soft text-base md:text-xl leading-relaxed break-words"
                    style={{
                      fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0',
                    }}
                  >
                    {step.instruction}
                  </p>
                </div>
              </motion.li>
            )
          })}
        </ol>
      )}
    </section>
  )
}


function SectionMark({ numeral, children }: { numeral: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-chestnut/30 pb-3">
      <span
        className="font-display text-paprika text-2xl leading-none"
        style={{ fontVariationSettings: '"opsz" 96, "SOFT" 30, "WONK" 1' }}
      >
        {numeral}.
      </span>
      <h2
        className="font-display text-ink text-2xl"
        style={{
          fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
          letterSpacing: '-0.015em',
        }}
      >
        {children}
      </h2>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="px-6 md:px-12 lg:px-20 py-16">
      <p className="eyebrow mb-6">Loading…</p>
      <div className="h-20 bg-cream-shadow/60 rounded mb-6 max-w-3xl" />
      <div className="h-5 bg-cream-shadow/40 rounded mb-2 max-w-2xl" />
      <div className="h-5 bg-cream-shadow/40 rounded max-w-xl" />
    </div>
  )
}

function DetailError({ error }: { error: unknown }) {
  const status = error instanceof ApiError ? error.status : null
  const isNotFound = status === 404

  return (
    <div className="px-6 md:px-12 lg:px-20 py-20">
      <p className="eyebrow text-paprika mb-3">{isNotFound ? 'Not on this shelf' : 'Could not open this recipe'}</p>
      <p className="text-ink-soft text-lg max-w-md">
        {isNotFound
          ? "That recipe doesn't exist (anymore). It may have been removed."
          : 'Something went wrong loading this page. Try again in a moment.'}
      </p>
      <Link
        to="/recipes"
        className="inline-block mt-6 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline"
      >
        ← Back to all recipes
      </Link>
    </div>
  )
}
