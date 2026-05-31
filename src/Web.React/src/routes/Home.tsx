import { useMemo } from 'react'
import { Link, Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { recipesApi } from '@/api/recipes'
import { mealPlanApi, MEAL_SLOT_ORDER } from '@/api/mealPlan'
import type { MealEntryDto } from '@/api/mealPlan'
import { formatDuration } from '@/lib/format'
import type { RecipeSummaryDto } from '@/api/types'

const ease = [0.22, 1, 0.36, 1] as const

// Shared button styles — Bricolage, sentence-case, soft corners. Hierarchy by
// weight (solid green = primary, solid ink = strongest, outline = secondary).
const btn =
  'inline-flex items-center gap-1.5 rounded-xl px-5 py-3 font-display font-semibold text-[0.92rem] leading-none no-underline transition-colors'
const btnGreen = `${btn} bg-paprika text-cream hover:bg-paprika-deep`
const btnDark = `${btn} bg-ink text-cream hover:bg-paprika`
const btnGhost = `${btn} border border-cream-shadow text-ink hover:border-paprika hover:text-paprika`
// Mustard-ochre = the "cook" accent (the appetizing action). Text on gold is a
// fixed dark forest so it stays legible in both light and dark themes.
const btnGold = `${btn} bg-butter text-[#1f2417] hover:bg-butter-deep`
const btnGoldGhost = `${btn} border border-butter/55 text-butter-deep hover:bg-butter hover:text-[#1f2417]`
const quietLink =
  'font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors no-underline'

// ── date helpers (local time) ───────────────────────────────────────────────
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
function startOfToday() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}
function dinnerFirst(a: MealEntryDto, b: MealEntryDto) {
  return MEAL_SLOT_ORDER.indexOf(a.slot) - MEAL_SLOT_ORDER.indexOf(b.slot)
}
function groupByDate(entries: MealEntryDto[]) {
  const map = new Map<string, MealEntryDto[]>()
  for (const e of entries) {
    const list = map.get(e.date)
    if (list) list.push(e)
    else map.set(e.date, [e])
  }
  for (const list of map.values()) list.sort(dinnerFirst)
  return map
}
function entryLabel(e: MealEntryDto) {
  return e.recipeId != null ? e.recipeTitle : e.freeText
}

export default function Home() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="px-5 sm:px-6 md:px-12 lg:px-20 py-24">
        <p className="eyebrow">Picking fresh…</p>
      </div>
    )
  }

  // Signed-out visitors go straight to the login page — no separate landing.
  if (!user) return <Navigate to="/login" replace />

  return <SignedInHome />
}

// ═══════════════════════════════════════════════════════════════════════════
// Signed-in
// ═══════════════════════════════════════════════════════════════════════════

function SignedInHome() {
  const recipesQ = useQuery({ queryKey: ['recipes-home'], queryFn: () => recipesApi.list() })

  const today = startOfToday()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today])
  const from = toISO(days[0])
  const to = toISO(days[6])
  const planQ = useQuery({ queryKey: ['meal-plan', from, to], queryFn: () => mealPlanApi.list({ from, to }) })

  const byDate = useMemo(() => groupByDate(planQ.data ?? []), [planQ.data])
  const tonight = byDate.get(toISO(today))?.[0] ?? null
  const plannedCount = planQ.data?.length ?? 0

  const recipes = recipesQ.data ?? []
  const sorted = [...recipes].sort((a, b) => b.id - a.id)
  const featured = sorted[0] ?? null
  const recent = sorted.slice(1, 5)

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-12 md:pt-20 pb-28">
      <Masthead totalRecipes={recipes.length} />

      <ThisWeek today={today} days={days} byDate={byDate} tonight={tonight} plannedCount={plannedCount} />

      {recipesQ.isPending && <FeaturedSkeleton />}
      {!recipesQ.isPending && !featured && <FirstRecipeInvitation />}
      {featured && <FeaturedCard recipe={featured} />}

      {recent.length > 0 && <FromTheShelf recipes={recent} />}

      <CloserActions />
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
    <header className="mb-20 md:mb-28">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="eyebrow flex items-center gap-2.5 flex-wrap"
      >
        <span>{today}</span>
        {totalRecipes > 0 && (
          <>
            <span className="text-chestnut-soft" aria-hidden>
              /
            </span>
            <span>
              <span className="num text-paprika">{String(totalRecipes).padStart(2, '0')}</span> recipes
            </span>
          </>
        )}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.7, ease }}
        className="mt-5 text-ink"
        style={{ fontSize: 'clamp(2.4rem, 6.5vw, 4.8rem)', lineHeight: 0.98, fontWeight: 800, letterSpacing: '-0.035em' }}
      >
        What&rsquo;s{' '}
        <span className="italic text-butter-deep" style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>
          cooking
        </span>
        ?
      </motion.h1>
    </header>
  )
}

// ── This week — Tonight banner + the days ahead ──────────────────────────────

function ThisWeek({
  today,
  days,
  byDate,
  tonight,
  plannedCount,
}: {
  today: Date
  days: Date[]
  byDate: Map<string, MealEntryDto[]>
  tonight: MealEntryDto | null
  plannedCount: number
}) {
  const wdLong = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(today)
  const wdShort = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
  const ahead = days.slice(1)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, duration: 0.6, ease }}
      className="mb-20 md:mb-28"
    >
      <div className="flex items-end justify-between gap-4 mb-7">
        <div className="flex items-baseline gap-3">
          <h2 className="text-ink text-2xl" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            This week
          </h2>
          {plannedCount > 0 && (
            <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-chestnut">
              <span className="text-paprika">{plannedCount}</span> planned
            </span>
          )}
        </div>
        <Link to="/meal-plan" className={quietLink}>
          Open meal plan →
        </Link>
      </div>

      {/* Tonight banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cream-shadow bg-cream-deep mb-4">
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-butter" />
        <div className="p-7 sm:p-9 pl-8 sm:pl-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-chestnut flex items-center gap-2 mb-2.5">
              <span className="text-butter-deep">Tonight</span>
              <span className="text-chestnut-soft" aria-hidden>
                ·
              </span>
              <span>{wdLong}</span>
            </p>
            {tonight ? (
              <span
                className="text-ink leading-tight block"
                style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.02em' }}
              >
                {entryLabel(tonight)}
              </span>
            ) : (
              <p className="text-ink-soft text-xl italic">Nothing planned yet.</p>
            )}
          </div>

          <div className="shrink-0">
            {tonight?.recipeId != null ? (
              <div className="flex items-center gap-5">
                <Link to={`/recipes/${tonight.recipeId}/cook`} className={btnGold}>
                  ▷ Cook now
                </Link>
                <Link to="/meal-plan" className={quietLink}>
                  Change
                </Link>
              </div>
            ) : (
              <Link to="/meal-plan" className={btnGreen}>
                {tonight ? 'Edit plan' : 'Plan tonight'}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Days ahead */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {ahead.map((d, i) => {
          const iso = toISO(d)
          const list = byDate.get(iso) ?? []
          const head = list[0] ?? null
          const extra = Math.max(0, list.length - 1)
          return (
            <motion.div
              key={iso}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.04, duration: 0.4, ease }}
            >
              <Link
                to="/meal-plan"
                className="group block no-underline rounded-xl border border-cream-shadow bg-cream-deep p-4 h-full min-h-[7.25rem] hover:border-paprika/50 transition-colors"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-chestnut">
                    {wdShort.format(d)}
                  </span>
                  <span className="num text-[0.95rem] leading-none text-ink-soft">{d.getDate()}</span>
                </div>
                {head ? (
                  <div className="flex items-baseline gap-1.5">
                    <span
                      aria-hidden
                      className={[
                        'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                        head.recipeId != null ? 'bg-paprika' : 'border border-chestnut-soft',
                      ].join(' ')}
                    />
                    <span className="text-ink text-[0.9rem] leading-tight line-clamp-2">
                      {entryLabel(head)}
                      {extra > 0 && <span className="text-chestnut-soft"> +{extra}</span>}
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-[0.58rem] text-chestnut-soft/70 inline-flex items-center gap-1 group-hover:text-paprika transition-colors">
                    <span className="text-base leading-none">+</span> plan
                  </span>
                )}
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}

// ── Featured recipe — one contained card ─────────────────────────────────────

function FeaturedCard({ recipe }: { recipe: RecipeSummaryDto }) {
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
      transition={{ delay: 0.22, duration: 0.6, ease }}
      className="mb-20 md:mb-28"
    >
      <SectionHeader title="Fresh pick" caption="Go to recipes" to="/recipes" />

      <div className="rounded-2xl border border-cream-shadow bg-cream-deep overflow-hidden grid grid-cols-1 sm:grid-cols-12">
        <Link to={`/recipes/${recipe.id}`} className="sm:col-span-5 lg:col-span-4 block h-full no-underline group">
          <div
            className="relative h-48 sm:h-full sm:min-h-[16rem] w-full bg-ink"
            style={
              heroImage
                ? { backgroundImage: `url(${heroImage.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : {
                    background:
                      'radial-gradient(120% 90% at 20% 20%, rgba(47,125,79,0.20), transparent 60%),' +
                      'linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream) 100%)',
                  }
            }
          >
            {!heroImage && (
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center text-paprika/20 leading-none"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 12vw, 7rem)', fontWeight: 800 }}
              >
                ❧
              </span>
            )}
          </div>
        </Link>

        <div className="sm:col-span-7 lg:col-span-8 p-7 md:p-10 flex flex-col">
          <Link to={`/recipes/${recipe.id}`} className="no-underline group">
            <h3
              className="text-ink group-hover:text-paprika transition-colors"
              style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2.2rem)', lineHeight: 1.02, fontWeight: 700, letterSpacing: '-0.02em' }}
            >
              {recipe.title}
            </h3>
          </Link>

          {recipe.summary && <p className="text-ink-soft leading-relaxed mt-3 max-w-xl line-clamp-2">{recipe.summary}</p>}

          <div className="flex items-center gap-7 mt-5">
            <Meta label="Serves" value={String(recipe.baseServings)} />
            {time && <Meta label="Time" value={time} />}
          </div>

          <div className="mt-7 sm:mt-auto pt-7 flex items-center gap-4 flex-wrap">
            <Link to={`/recipes/${recipe.id}`} className={btnGreen}>
              Open recipe
            </Link>
            <Link to={`/recipes/${recipe.id}/cook`} className={btnGoldGhost}>
              ▷ Cook now
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="num text-paprika text-xl">{value}</span>
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-chestnut">{label}</span>
    </span>
  )
}

// ── Recent recipes — calm list ──────────────────────────────────────────────

function FromTheShelf({ recipes }: { recipes: RecipeSummaryDto[] }) {
  return (
    <section className="mb-20 md:mb-28">
      <SectionHeader title="From the garden" caption="Recently added" />

      <ul className="border-y border-cream-shadow divide-y divide-cream-shadow">
        {recipes.map((recipe, i) => (
          <motion.li
            key={recipe.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28 + i * 0.05, duration: 0.4, ease }}
          >
            <Link to={`/recipes/${recipe.id}`} className="group flex items-baseline gap-5 py-5 no-underline">
              <span className="num text-chestnut-soft text-sm shrink-0 w-6">{String(i + 1).padStart(2, '0')}</span>
              <h3
                className="flex-1 min-w-0 text-ink text-lg group-hover:text-paprika transition-colors truncate"
                style={{ fontWeight: 700, letterSpacing: '-0.01em' }}
              >
                {recipe.title}
              </h3>
              {recipe.tags.length > 0 && (
                <span className="hidden md:block font-mono text-[0.58rem] uppercase tracking-[0.14em] text-chestnut-soft truncate max-w-[12rem]">
                  {recipe.tags.slice(0, 3).join(' · ')}
                </span>
              )}
              <span className="shrink-0 num text-chestnut text-sm">{recipe.baseServings}p</span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}

function CloserActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6, ease }}
      className="rounded-2xl border border-cream-shadow bg-cream-deep p-7 sm:p-9 flex flex-col sm:flex-row sm:items-center justify-between gap-7"
    >
      <div>
        <p className="eyebrow mb-2">Keep cooking</p>
        <p className="text-ink text-lg" style={{ fontWeight: 600 }}>
          Add a recipe, or plan the days ahead.
        </p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Link to="/recipes/new" className={btnDark}>
          + Add a recipe
        </Link>
        <Link to="/meal-plan" className={btnGhost}>
          Plan the week
        </Link>
      </div>
    </motion.div>
  )
}

// ── shared ──────────────────────────────────────────────────────────────────

function SectionHeader({ title, caption, to }: { title: string; caption: string; to?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-8 border-b border-cream-shadow pb-4">
      <h2 className="text-ink text-xl" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>
        {title}
      </h2>
      {to ? (
        <Link
          to={to}
          className="ml-auto font-mono text-[0.64rem] uppercase tracking-[0.16em] text-paprika hover:text-paprika-deep transition-colors no-underline inline-flex items-center gap-1.5"
        >
          {caption}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      ) : (
        <span className="ml-auto font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chestnut-soft">{caption}</span>
      )}
    </div>
  )
}

// ── empty / loading ─────────────────────────────────────────────────────────

function FeaturedSkeleton() {
  return (
    <div className="mb-20 md:mb-28">
      <div className="h-6 w-36 bg-cream-shadow/50 rounded mb-8" />
      <div className="rounded-2xl border border-cream-shadow bg-cream-deep overflow-hidden grid grid-cols-1 sm:grid-cols-12">
        <div className="sm:col-span-5 lg:col-span-4 h-48 sm:min-h-[16rem] bg-cream-shadow/40 animate-pulse" />
        <div className="sm:col-span-7 lg:col-span-8 p-7 md:p-10 space-y-4">
          <div className="h-7 bg-cream-shadow/50 rounded w-2/3" />
          <div className="h-4 bg-cream-shadow/50 rounded w-1/2" />
          <div className="h-10 bg-cream-shadow/50 rounded-xl w-40 mt-7" />
        </div>
      </div>
    </div>
  )
}

function FirstRecipeInvitation() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.6, ease }}
      className="mb-20 md:mb-28"
    >
      <SectionHeader title="Fresh pick" caption="Nothing yet" />
      <div className="rounded-2xl border border-cream-shadow bg-cream-deep p-9 md:p-12 max-w-2xl">
        <h3
          className="text-ink mb-3"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', lineHeight: 1.0, fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          Plant your first recipe.
        </h3>
        <p className="text-ink-soft leading-relaxed mb-7 max-w-md">
          Paste a link from Dagelijkse Kost or AH Allerhande and Cookmate parses it into a draft you can polish.
        </p>
        <Link to="/recipes/new" className={btnDark}>
          + Add a recipe
        </Link>
      </div>
    </motion.section>
  )
}

