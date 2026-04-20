import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { recipesApi } from '@/api/recipes'
import { formatDuration } from '@/lib/format'
import type { RecipeSummaryDto } from '@/api/types'

const ease = [0.22, 1, 0.36, 1] as const

export default function Home() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="px-6 md:px-12 lg:px-20 py-20">
        <p className="eyebrow">Heating up…</p>
      </div>
    )
  }

  return user ? <SignedInHome /> : <LandingHome />
}

// ───────────────────────────────────────────────────────────────────────────────
// Signed-in: editorial masthead with the most recently added recipe up front.
// ───────────────────────────────────────────────────────────────────────────────

function SignedInHome() {
  const query = useQuery({
    queryKey: ['recipes-home'],
    queryFn: () => recipesApi.list(),
  })

  const recipes = query.data ?? []
  // Higher id = added later; works for personal-scale shelves without a server sort.
  const sorted = [...recipes].sort((a, b) => b.id - a.id)
  const featured = sorted[0] ?? null
  const recent = sorted.slice(1, 6)

  return (
    <div className="grain px-6 md:px-12 lg:px-20 pt-10 md:pt-16 pb-16">
      <Masthead totalRecipes={recipes.length} />

      {query.isPending && <FeaturedSkeleton />}

      {!query.isPending && !featured && <FirstRecipeInvitation />}

      {featured && (
        <FeaturedCard recipe={featured} totalRecipes={recipes.length} />
      )}

      {recent.length > 0 && <FromTheShelf recipes={recent} />}

      {recipes.length > 0 && <CloserActions />}
    </div>
  )
}

function Masthead({ totalRecipes }: { totalRecipes: number }) {
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <header className="grid grid-cols-12 gap-y-6 gap-x-6 mb-10 md:mb-14">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="eyebrow col-span-12"
      >
        {today}
        {totalRecipes > 0 && (
          <>
            <span className="text-chestnut-soft mx-2">·</span>
            <span className="num text-paprika">{String(totalRecipes).padStart(2, '0')}</span>
            {' '}
            <span>{totalRecipes === 1 ? 'recipe on the shelf' : 'recipes on the shelf'}</span>
          </>
        )}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.7, ease }}
        className="col-span-12 lg:col-span-10 font-display text-ink"
        style={{
          fontSize: 'clamp(3rem, 9vw, 8rem)',
          lineHeight: 0.92,
          letterSpacing: '-0.04em',
          fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
        }}
      >
        What's{' '}
        <span
          className="italic text-paprika"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
        >
          cooking
        </span>
        ?
      </motion.h1>
    </header>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function FeaturedCard({
  recipe,
  totalRecipes,
}: {
  recipe: RecipeSummaryDto
  totalRecipes: number
}) {
  // The list endpoint returns RecipeSummaryDto without media; fetch the full
  // recipe lazily for its first image. One extra request, keeps the home snappy.
  const detail = useQuery({
    queryKey: ['recipe', recipe.id],
    queryFn: () => recipesApi.get(recipe.id),
    staleTime: 60_000,
  })

  const heroImage = detail.data?.media.find((m) => m.type === 1) ?? null
  const time = formatDuration(recipe.totalTimeMinutes)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.7, ease }}
      className="grid grid-cols-12 gap-x-6 gap-y-6 mb-16"
    >
      <Link
        to={`/recipes/${recipe.id}`}
        className="col-span-12 lg:col-span-8 group relative no-underline"
      >
        <div
          className="relative aspect-[16/10] md:aspect-[21/11] w-full overflow-hidden bg-ink rounded-sm"
          style={
            heroImage
              ? {
                  backgroundImage: `url(${heroImage.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {
                  background:
                    'radial-gradient(120% 80% at 18% 30%, rgba(232,90,26,0.10), transparent 55%),' +
                    'radial-gradient(80% 60% at 85% 80%, rgba(123,94,63,0.10), transparent 60%),' +
                    'linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream) 100%)',
                }
          }
        >
          {!heroImage && (
            <span
              aria-hidden
              className="absolute right-[-3vw] top-1/2 -translate-y-1/2 select-none text-paprika/15 leading-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(10rem, 22vw, 24rem)',
                fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
                letterSpacing: '-0.05em',
              }}
            >
              ❦
            </span>
          )}

          {heroImage && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(0deg, var(--color-cream) 0%, transparent 55%)',
              }}
            />
          )}

          <div className="absolute inset-x-0 bottom-0 px-6 md:px-10 pb-7 md:pb-10">
            <p className="eyebrow text-paprika mb-2">
              Just landed · No. {String(totalRecipes).padStart(2, '0')}
            </p>
            <h2
              className="font-display text-ink max-w-3xl group-hover:text-paprika transition-colors"
              style={{
                fontSize: 'clamp(2rem, 5vw, 4rem)',
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
              }}
            >
              {recipe.title}
            </h2>
          </div>
        </div>
      </Link>

      <aside className="col-span-12 lg:col-span-4 flex flex-col justify-end pl-0 lg:pl-2">
        {recipe.summary && (
          <p
            className="font-display text-ink-soft text-lg leading-relaxed mb-6 max-w-md"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
          >
            {recipe.summary}
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 max-w-md">
          <div>
            <p className="eyebrow mb-1">Serves</p>
            <p className="num text-paprika text-2xl">{recipe.baseServings}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Time</p>
            <p className="num text-paprika text-2xl">
              {time ?? <span className="text-chestnut-soft">—</span>}
            </p>
          </div>
        </div>

        {recipe.tags.length > 0 && (
          <div className="mb-6 max-w-md">
            <p className="eyebrow mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map((t) => (
                <Link
                  key={t}
                  to={`/recipes?tag=${encodeURIComponent(t)}`}
                  className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors no-underline border border-cream-shadow hover:border-paprika px-2 py-0.5 rounded-sm"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-baseline gap-4 flex-wrap">
          <Link
            to={`/recipes/${recipe.id}`}
            className="inline-flex items-center gap-2 px-5 py-3 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.74rem] hover:bg-paprika transition-colors no-underline"
          >
            Open recipe
            <span aria-hidden>→</span>
          </Link>
          <Link
            to={`/recipes/${recipe.id}/cook`}
            className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline no-underline"
          >
            ▷ Cook now
          </Link>
        </div>
      </aside>
    </motion.section>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function FromTheShelf({ recipes }: { recipes: RecipeSummaryDto[] }) {
  return (
    <section className="mb-16">
      <Ornament />

      <div className="flex items-baseline gap-3 mb-6 border-b border-chestnut/30 pb-3">
        <span
          className="font-display text-paprika text-2xl leading-none"
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 30, "WONK" 1' }}
        >
          §
        </span>
        <h2
          className="font-display text-ink text-2xl"
          style={{
            fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
            letterSpacing: '-0.015em',
          }}
        >
          From the shelf
        </h2>
        <span className="ml-auto font-mono text-[0.7rem] uppercase tracking-[0.2em] text-chestnut">
          Recently added
        </span>
      </div>

      <ol>
        {recipes.map((recipe, i) => (
          <motion.li
            key={recipe.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.5, ease }}
            className="border-b border-cream-shadow"
          >
            <Link
              to={`/recipes/${recipe.id}`}
              className="group grid grid-cols-12 gap-4 py-5 items-baseline no-underline"
            >
              <span className="num text-chestnut text-sm col-span-2 sm:col-span-1">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="col-span-10 sm:col-span-7 lg:col-span-7">
                <h3
                  className="font-display text-ink text-xl md:text-2xl group-hover:text-paprika transition-colors"
                  style={{
                    fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {recipe.title}
                </h3>
                {recipe.tags.length > 0 && (
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-chestnut-soft mt-1">
                    {recipe.tags.slice(0, 4).join(' · ')}
                  </p>
                )}
              </div>

              <p className="hidden lg:block lg:col-span-2 text-chestnut text-sm leading-snug truncate">
                {recipe.summary ?? '—'}
              </p>

              <span className="col-span-12 sm:col-span-4 lg:col-span-2 text-right flex flex-col items-end gap-0.5">
                <span>
                  <span className="num text-paprika text-base">{recipe.baseServings}</span>
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut ml-2">
                    serves
                  </span>
                </span>
                {formatDuration(recipe.totalTimeMinutes) && (
                  <span className="num text-chestnut text-xs">
                    {formatDuration(recipe.totalTimeMinutes)}
                  </span>
                )}
              </span>
            </Link>
          </motion.li>
        ))}
      </ol>
    </section>
  )
}

function CloserActions() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="flex items-baseline justify-between gap-4 flex-wrap"
    >
      <Link
        to="/recipes/new"
        className="inline-flex items-center gap-2 px-6 py-3.5 bg-paprika text-cream font-mono uppercase tracking-[0.18em] text-[0.74rem] hover:bg-paprika-deep transition-colors no-underline"
      >
        + Add a recipe
      </Link>
      <Link
        to="/recipes"
        className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors no-underline"
      >
        Browse the full shelf →
      </Link>
    </motion.div>
  )
}

function Ornament() {
  return (
    <div className="flex items-center gap-6 my-12 max-w-3xl mx-auto" aria-hidden>
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
// Empty / loading / landing states
// ───────────────────────────────────────────────────────────────────────────────

function FeaturedSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-6 mb-16">
      <div className="col-span-12 lg:col-span-8 aspect-[16/10] md:aspect-[21/11] bg-cream-shadow/40 rounded-sm" />
      <div className="col-span-12 lg:col-span-4 space-y-3">
        <div className="h-4 bg-cream-shadow/40 rounded w-3/4" />
        <div className="h-4 bg-cream-shadow/40 rounded w-1/2" />
        <div className="h-10 bg-cream-shadow/40 rounded w-2/3 mt-6" />
      </div>
    </div>
  )
}

function FirstRecipeInvitation() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.7, ease }}
      className="grid grid-cols-12 gap-x-6 gap-y-6 mb-12"
    >
      <div
        className="relative col-span-12 lg:col-span-8 aspect-[16/10] md:aspect-[21/11] w-full overflow-hidden rounded-sm grain"
        style={{
          background:
            'radial-gradient(120% 80% at 18% 30%, rgba(232,90,26,0.12), transparent 55%),' +
            'radial-gradient(80% 60% at 85% 80%, rgba(123,94,63,0.12), transparent 60%),' +
            'linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream) 100%)',
        }}
      >
        <span
          aria-hidden
          className="absolute right-[-3vw] top-1/2 -translate-y-1/2 select-none text-paprika/20 leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(10rem, 22vw, 24rem)',
            fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
            letterSpacing: '-0.05em',
          }}
        >
          ❦
        </span>
        <div className="absolute inset-x-0 bottom-0 px-6 md:px-10 pb-7 md:pb-10">
          <p className="eyebrow text-paprika mb-2">An empty shelf</p>
          <h2
            className="font-display text-ink max-w-3xl"
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
              fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
            }}
          >
            Save your first recipe.
          </h2>
        </div>
      </div>

      <aside className="col-span-12 lg:col-span-4 flex flex-col justify-end">
        <p
          className="font-display text-ink-soft text-lg leading-relaxed mb-6 max-w-md"
          style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
        >
          Paste a link from Dagelijkse Kost or AH Allerhande and Cookmate parses
          it into a draft you can polish. Or start from a blank page.
        </p>
        <div className="flex items-baseline gap-4 flex-wrap">
          <Link
            to="/recipes/new"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-paprika text-cream font-mono uppercase tracking-[0.18em] text-[0.74rem] hover:bg-paprika-deep transition-colors no-underline"
          >
            + Add a recipe
          </Link>
        </div>
      </aside>
    </motion.section>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// Public landing — kept editorial as the cover for first-time visitors.
// ───────────────────────────────────────────────────────────────────────────────

const headline = ['A', 'cookbook', 'that', 'cooks', 'with', 'you.']
const chapters = [
  {
    n: '01',
    title: 'Recipes',
    body: "Family favourites and lifted-from-the-internet keepers, edited the way you actually make them.",
    to: '/recipes',
  },
  {
    n: '02',
    title: 'Pantry',
    body: 'Scan a barcode, build a pantry, and let Cookmate suggest what to make with what you already have.',
    to: '/pantry',
  },
  {
    n: '03',
    title: 'Shop',
    body: "Build a basket from the recipes you cook this week and send it to Albert Heijn (and friends) in one click.",
    to: '/shop',
  },
]

/**
 * Decorative right-side anchor for the landing hero — sits behind the content
 * so the headline + body reads first, but balances the canvas with paprika
 * weight: an oversized ❦ glyph, a small "stamp" badge, and a vertical italic
 * editorial caption. Hidden on mobile to keep the headline breathing room.
 */
function CoverAnchor() {
  return (
    <div
      aria-hidden
      className="hidden lg:block absolute top-0 right-0 h-full w-2/5 pointer-events-none"
    >
      {/* Large ornament centred vertically */}
      <span
        className="absolute right-[-2vw] top-1/2 -translate-y-1/2 select-none text-paprika/15 leading-none"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(14rem, 26vw, 28rem)',
          fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
          letterSpacing: '-0.05em',
        }}
      >
        ❦
      </span>

      {/* Stamp badge — small circular mark, like a magazine cover sticker */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: -8 }}
        transition={{ delay: 0.85, duration: 0.7, ease }}
        className="absolute top-2 right-12 w-28 h-28 rounded-full border-2 border-paprika/50 flex flex-col items-center justify-center text-paprika"
      >
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em]">Vol</span>
        <span
          className="num text-2xl leading-none mt-0.5"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          01
        </span>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.2em] mt-0.5">2026</span>
      </motion.div>

      {/* Vertical editorial caption running down the right edge */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        className="absolute right-3 bottom-12 font-display italic text-chestnut text-sm whitespace-nowrap"
        style={{
          writingMode: 'vertical-rl',
          fontVariationSettings: '"opsz" 24, "SOFT" 70, "WONK" 1',
        }}
      >
        — Cook with what you have.
      </motion.p>
    </div>
  )
}

function LandingHome() {
  return (
    <div className="grain px-6 md:px-12 lg:px-20">
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative pt-12 md:pt-20 pb-16 md:pb-24 grid grid-cols-12 gap-x-6 gap-y-10">
        {/* Eyebrow runs the full width as a masthead */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="eyebrow col-span-12 flex items-baseline gap-3"
        >
          <span>Volume 01</span>
          <span className="text-chestnut-soft" aria-hidden>·</span>
          <span>In de keuken</span>
          <span className="text-chestnut-soft" aria-hidden>·</span>
          <span>April 2026</span>
          <span className="hidden md:inline-block ml-auto h-px w-24 bg-cream-shadow translate-y-[-4px]" aria-hidden />
        </motion.p>

        {/* Decorative cover anchor — sits BEHIND the right side, balances the headline */}
        <CoverAnchor />

        {/* Headline takes ~7 cols so it doesn't slam into the cover anchor */}
        <h1
          className="relative col-span-12 lg:col-span-7 font-display text-ink"
          style={{
            fontSize: 'clamp(3rem, 8.5vw, 7.5rem)',
            lineHeight: 0.92,
            letterSpacing: '-0.035em',
            fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
          }}
        >
          {headline.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ opacity: 0, y: 24, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.7, ease }}
              className={
                'inline-block mr-[0.18em] ' +
                (word === 'cooks' ? 'italic text-paprika' : '')
              }
              style={
                word === 'cooks'
                  ? { fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }
                  : undefined
              }
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Body + CTA stacked TOGETHER so the action sits with the copy that motivates it */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="relative col-span-12 md:col-span-9 lg:col-span-6"
        >
          <p
            className="font-display text-ink-soft text-lg md:text-xl leading-relaxed mb-8 max-w-xl"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
          >
            A small, opinionated kitchen companion. Save the recipes you actually cook,
            scale them to the table you're feeding, and stop printing PDF after PDF.
          </p>
          <div className="flex items-baseline gap-6 flex-wrap">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.74rem] hover:bg-paprika transition-colors no-underline"
            >
              Open the cookbook
              <span aria-hidden>→</span>
            </Link>
          </div>
        </motion.div>
      </section>

      <motion.hr
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 1.0, duration: 1.0, ease }}
        className="rule-warm h-px border-0 origin-left"
      />

      {/* ─── INSIDE THIS VOLUME ─────────────────────────────────────── */}
      <section className="pt-14 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.6, ease }}
          className="flex items-baseline gap-3 mb-10 border-b border-chestnut/30 pb-3"
        >
          <span
            className="font-display text-paprika text-2xl leading-none"
            style={{ fontVariationSettings: '"opsz" 96, "SOFT" 30, "WONK" 1' }}
          >
            §
          </span>
          <h2
            className="font-display text-ink text-2xl"
            style={{
              fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
              letterSpacing: '-0.015em',
            }}
          >
            Inside this volume
          </h2>
          <span className="ml-auto font-mono text-[0.7rem] uppercase tracking-[0.2em] text-chestnut">
            Three chapters
          </span>
        </motion.div>

        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          {chapters.map((c, i) => (
            <motion.article
              key={c.n}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + i * 0.12, duration: 0.7, ease }}
              className="col-span-12 md:col-span-4 group"
            >
              <Link to={c.to} className="block no-underline">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="num text-chestnut text-sm">{c.n}</span>
                  <span className="h-px flex-1 bg-cream-shadow translate-y-[-4px]" />
                </div>
                <h2
                  className="font-display text-ink text-4xl md:text-[2.4rem] mb-3 transition-colors group-hover:text-paprika"
                  style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1', letterSpacing: '-0.02em' }}
                >
                  {c.title}
                </h2>
                <p className="text-ink-soft leading-relaxed mb-4">{c.body}</p>
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika inline-flex items-center gap-2">
                  Open
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  )
}
