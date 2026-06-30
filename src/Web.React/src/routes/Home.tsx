import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { recipesApi } from '@/api/recipes'
import { mealPlanApi, MEAL_SLOT_ORDER, MEAL_SLOT_ICON, MEAL_SLOT_LABELS } from '@/api/mealPlan'
import type { MealEntryDto } from '@/api/mealPlan'
import { DayPlannerDialog } from '@/components/DayPlannerDialog'
import { useSwipe } from '@/lib/useSwipe'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { suggestionsApi } from '@/api/suggestions'
import { promotionsApi } from '@/api/promotions'
import { formatDuration } from '@/lib/format'
import type { RecipeSummaryDto } from '@/api/types'

const ease = [0.22, 1, 0.36, 1] as const
const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

// Shared button styles — Bricolage, sentence-case, soft corners. Hierarchy by
// weight (solid green = primary, solid ink = strongest, outline = secondary).
const btn =
  'inline-flex items-center gap-1.5 rounded-xl px-5 py-3 font-display font-semibold text-[0.92rem] leading-none no-underline transition-colors'
const btnGreen = `${btn} bg-paprika text-cream hover:bg-paprika-deep`
const btnDark = `${btn} bg-ink text-cream hover:bg-paprika`
// Mustard-ochre ghost = the secondary "week action" accent (shop, calendar).
const btnGoldGhost = `${btn} border border-butter/55 text-butter-deep hover:bg-butter hover:text-[#1f2417]`

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

  const recipes = recipesQ.data ?? []
  const sorted = [...recipes].sort((a, b) => b.id - a.id)
  const featured = sorted[0] ?? null
  const recent = sorted.slice(1, 5)

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-12 md:pt-20 pb-28">
      <Masthead totalRecipes={recipes.length} />

      <Planner />

      {recipesQ.isPending && <FeaturedSkeleton />}
      {!recipesQ.isPending && !featured && <FirstRecipeInvitation />}
      {featured && <FeaturedCard recipe={featured} />}

      <SuggestedThisWeek />

      <HomePromos />

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

// ── Planner — three plannable days in a carousel ─────────────────────────────

function Planner() {
  const today = useMemo(() => startOfToday(), [])
  const todayIso = toISO(today)
  const tomorrowIso = toISO(addDays(today, 1))
  const [anchor, setAnchor] = useState<Date>(today)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Three days up front on mobile; a full week once there's room on desktop. The
  // window slides a day at a time (carousel arrows or swipe); the calendar covers
  // anything further out.
  const dayCount = useMediaQuery('(min-width: 1024px)') ? 7 : 3
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => addDays(anchor, i)), [anchor, dayCount])
  const from = toISO(days[0])
  const to = toISO(days[days.length - 1])
  const gridQ = useQuery({ queryKey: ['meal-plan', from, to], queryFn: () => mealPlanApi.list({ from, to }) })
  const byDate = useMemo(() => groupByDate(gridQ.data ?? []), [gridQ.data])

  const plannedCount = gridQ.data?.length ?? 0
  const wdShort = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
  const fmtMon = new Intl.DateTimeFormat(undefined, { month: 'short' })
  const fmtMd = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
  const periodLabel = `${fmtMd.format(days[0])} – ${fmtMd.format(days[days.length - 1])}`
  const atToday = toISO(anchor) === todayIso

  const stepDay = (n: number) => setAnchor((a) => addDays(a, n))
  // On touch, swipe the three-day window left/right.
  const swipe = useSwipe(() => stepDay(1), () => stepDay(-1))

  return (
    <motion.section
      id="planner"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, duration: 0.6, ease }}
      className="mb-20 md:mb-28 scroll-mt-24"
    >
      {/* Title + the three week actions, on one line */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-ink text-2xl" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            Your plan
          </h2>
          {plannedCount > 0 && (
            <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-chestnut">
              <span className="text-paprika">{plannedCount}</span> planned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <Link to="/suggestions" className={`${btnGreen} whitespace-nowrap`}>
            🥗 Meal ideas →
          </Link>
          <Link to="/shopping-cart" className={`${btnGoldGhost} whitespace-nowrap`}>
            🛒 Shopping cart →
          </Link>
          <Link to="/promos" className={`${btnGoldGhost} whitespace-nowrap`}>
            🏷️ Promos →
          </Link>
          <Link to="/calendar" className={`${btnGoldGhost} whitespace-nowrap`}>
            🗓️ Calendar →
          </Link>
        </div>
      </div>

      {/* Period caption + reset to today */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink">{periodLabel}</span>
        <button
          type="button"
          onClick={() => setAnchor(today)}
          disabled={atToday}
          className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors disabled:opacity-30 disabled:hover:text-chestnut"
        >
          ↺ Today
        </button>
      </div>

      {/* Carousel — arrows flank the cards (desktop); swipe on touch. */}
      <div className="flex items-stretch gap-2 sm:gap-3">
        <CarouselArrow direction={-1} onClick={() => stepDay(-1)} label="Previous day" />
        <div className="flex-1 grid grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3 touch-pan-y" {...swipe}>
          {days.map((d, i) => {
            const iso = toISO(d)
            const list = byDate.get(iso) ?? []
            const head = list[0] ?? null
            const extra = Math.max(0, list.length - 1)
            const isToday = iso === todayIso
            const isPast = iso < todayIso
            const isWeekend = d.getDay() === 0 || d.getDay() === 6
            const relLabel = isToday ? 'Today' : iso === tomorrowIso ? 'Tomorrow' : null

            // Colour-coded date band so the day — and whether it's a weekend —
            // reads at a glance: today fills paprika, weekends carry butter.
            const band = isToday
              ? 'bg-paprika text-cream'
              : isWeekend
                ? 'bg-butter-tint text-butter-deep'
                : 'bg-cream-shadow/25 text-ink'

            return (
              <motion.div
                key={iso}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.4, ease }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={[
                    'group block w-full text-left rounded-xl border overflow-hidden h-full transition-colors',
                    isToday ? 'border-paprika/60 ring-1 ring-inset ring-paprika/30' : 'border-cream-shadow hover:border-paprika/50',
                    isPast ? 'opacity-55 hover:opacity-100' : '',
                  ].join(' ')}
                >
                  {/* Date band — the clear "which day is this" header */}
                  <div className={['px-3 py-2 flex items-center justify-between gap-2', band].join(' ')}>
                    <span className="font-display leading-none truncate" style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                      {relLabel ?? wdShort.format(d)}
                    </span>
                    <span className="num leading-none shrink-0 text-[0.86rem]">
                      {d.getDate()} {fmtMon.format(d)}
                    </span>
                  </div>

                  {/* Photo area — reserved so every card is the same height */}
                  <div className="aspect-[3/2] overflow-hidden bg-cream-shadow/20 grid place-items-center">
                    {head?.imageUrl ? (
                      <img
                        src={head.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <span aria-hidden className="text-2xl leading-none opacity-25">🍽️</span>
                    )}
                  </div>

                  <div className="p-3 sm:p-4 bg-cream-deep">
                    {head ? (
                      <div className="flex items-start gap-1.5">
                        <span aria-hidden className="text-sm leading-snug shrink-0" title={MEAL_SLOT_LABELS[head.slot]}>
                          {MEAL_SLOT_ICON[head.slot]}
                        </span>
                        <span className="text-ink text-[0.9rem] leading-snug line-clamp-2">
                          {entryLabel(head)}
                          {extra > 0 && <span className="text-chestnut-soft"> +{extra}</span>}
                        </span>
                      </div>
                    ) : isPast ? (
                      <span className="font-mono text-[0.58rem] text-chestnut-soft/60">—</span>
                    ) : (
                      <span className="font-mono text-[0.58rem] text-chestnut-soft/70 inline-flex items-center gap-1 group-hover:text-paprika transition-colors">
                        <span className="text-base leading-none">+</span> plan
                      </span>
                    )}
                  </div>
                </button>
              </motion.div>
            )
          })}
        </div>
        <CarouselArrow direction={1} onClick={() => stepDay(1)} label="Next day" />
      </div>

      <DayPlannerDialog
        open={selectedDate != null}
        initialDate={selectedDate}
        onClose={() => setSelectedDate(null)}
      />
    </motion.section>
  )
}

// Carousel-style stepper, vertically centred beside the cards. Hidden on touch
// (where you swipe instead) to keep the three cards as wide as possible.
function CarouselArrow({ direction, onClick, label }: { direction: number; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="hidden sm:flex shrink-0 self-center w-11 h-11 items-center justify-center rounded-full font-mono text-lg text-chestnut border border-cream-shadow bg-cream-deep hover:border-paprika hover:text-paprika hover:bg-paprika-tint transition-colors"
    >
      {direction < 0 ? '‹' : '›'}
    </button>
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

          <div className="mt-6 sm:mt-auto pt-6 flex items-stretch sm:items-center gap-3">
            <Link to={`/recipes/${recipe.id}`} className={`${btnGreen} flex-1 sm:flex-none justify-center whitespace-nowrap`}>
              Open recipe
            </Link>
            <Link to={`/recipes/${recipe.id}/cook`} className={`${btnGoldGhost} shrink-0 justify-center whitespace-nowrap`}>
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

// ── This week's suggested ideas (scraped pool) ──────────────────────────────

function weekdayShort(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' })
}

function SuggestedThisWeek() {
  const weeklyQ = useQuery({ queryKey: ['suggestions-weekly'], queryFn: () => suggestionsApi.weekly() })

  const days = weeklyQ.data?.days ?? []
  const filled = days.filter((d) => d.suggestion)
  // Quietly stay out of the way until the pool has something to propose.
  if (!weeklyQ.isSuccess || filled.length === 0) return null

  return (
    <section className="mb-20 md:mb-28">
      <SectionHeader title="This week's ideas" caption="Browse all" to="/suggestions" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {days.map((day, i) => {
          const inner = (
            <>
              <div className="aspect-[4/3] bg-cream-shadow/40 grid place-items-center overflow-hidden">
                {day.suggestion?.imageUrl ? (
                  <img
                    src={day.suggestion.imageUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span aria-hidden className="text-2xl leading-none opacity-60">🍽️</span>
                )}
              </div>
              <div className="p-2.5 flex-1 flex flex-col">
                <span className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-chestnut-soft">
                  {weekdayShort(day.date)}
                </span>
                {day.suggestion ? (
                  <span
                    className="text-ink text-sm leading-tight mt-0.5 group-hover:text-paprika transition-colors line-clamp-2"
                    style={{ fontWeight: 700, letterSpacing: '-0.01em' }}
                  >
                    {day.suggestion.title}
                  </span>
                ) : (
                  <span className="text-chestnut-soft text-sm mt-0.5">—</span>
                )}
              </div>
            </>
          )
          return (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.04, duration: 0.4, ease }}
              className="rounded-xl border border-cream-shadow bg-cream-deep overflow-hidden flex flex-col hover:border-paprika/50 transition-colors"
            >
              {day.suggestion ? (
                <Link to={`/suggestions/${day.suggestion.id}`} className="group flex flex-1 flex-col no-underline">
                  {inner}
                </Link>
              ) : (
                <div className="flex flex-1 flex-col">{inner}</div>
              )}
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

// ── Featured promos (this week's bonus) ─────────────────────────────────────

function HomePromos() {
  const promosQ = useQuery({
    queryKey: ['promotions', 'ah', 'home'],
    queryFn: () => promotionsApi.list('ah'),
    staleTime: 5 * 60_000,
  })
  const promos = (promosQ.data ?? []).slice(0, 6)
  // Stay out of the way until the bonus is loaded.
  if (!promosQ.isSuccess || promos.length === 0) return null

  return (
    <section className="mb-20 md:mb-28">
      <SectionHeader title="In the bonus" caption="Shop promos" to="/promos" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {promos.map((p, i) => (
          <motion.div
            key={p.sku}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.04, duration: 0.4, ease }}
          >
            <Link
              to="/promos"
              className="group flex h-full flex-col rounded-xl border border-cream-shadow bg-cream-deep overflow-hidden no-underline hover:border-paprika/50 transition-colors"
            >
              <span className="aspect-square bg-cream-shadow/20 grid place-items-center overflow-hidden">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span aria-hidden className="text-2xl leading-none opacity-30">🛒</span>
                )}
              </span>
              <span className="p-2.5 flex flex-1 flex-col gap-1">
                <span
                  className="text-ink text-[0.82rem] leading-tight line-clamp-2 group-hover:text-paprika transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {p.name}
                </span>
                <span className="mt-auto flex items-center flex-wrap gap-x-1.5 gap-y-1 pt-1">
                  {p.discountLabel && (
                    <span className="rounded bg-butter text-ink px-1.5 py-0.5 font-display font-bold text-[0.66rem] leading-none">
                      {p.discountLabel}
                    </span>
                  )}
                  {p.promoPrice != null && <span className="num text-paprika text-sm">{euro.format(p.promoPrice)}</span>}
                </span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function FromTheShelf({ recipes }: { recipes: RecipeSummaryDto[] }) {
  return (
    <section className="mb-20 md:mb-28">
      <SectionHeader title="From the garden" caption="Recently added" />

      <ul className="divide-y divide-cream-shadow">
        {recipes.map((recipe, i) => (
          <motion.li
            key={recipe.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28 + i * 0.05, duration: 0.4, ease }}
          >
            <Link to={`/recipes/${recipe.id}`} className="group flex items-center gap-4 py-3.5 no-underline">
              <span className="num text-chestnut-soft text-sm shrink-0 w-5">{String(i + 1).padStart(2, '0')}</span>
              <RecipeThumb url={recipe.coverImageUrl} />
              <div className="flex-1 min-w-0">
                <h3
                  className="text-ink text-lg group-hover:text-paprika transition-colors truncate"
                  style={{ fontWeight: 700, letterSpacing: '-0.01em' }}
                >
                  {recipe.title}
                </h3>
                {recipe.tags.length > 0 && (
                  <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-chestnut-soft mt-0.5 truncate">
                    {recipe.tags.slice(0, 3).join(' · ')}
                  </p>
                )}
              </div>
              <span className="shrink-0 num text-chestnut text-sm">{recipe.baseServings}p</span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}

function RecipeThumb({ url }: { url: string | null }) {
  return (
    <span className="w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-cream-deep border border-cream-shadow grid place-items-center">
      {url ? (
        <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden className="text-base leading-none opacity-70">🍽️</span>
      )}
    </span>
  )
}

const closerTiles = [
  { to: '/recipes/new', icon: '🌱', title: 'Add a recipe', caption: 'Paste a link or write your own' },
  { to: '/calendar', icon: '🗓️', title: 'Open the calendar', caption: 'Plan any day, browse the month' },
  { to: '/suggestions', icon: '🥗', title: 'Browse ideas', caption: 'Fresh picks from your sources' },
  { to: '/shopping-cart', icon: '🛒', title: 'Shopping cart', caption: 'Your one running basket' },
]

const closerTileClass =
  'group h-full rounded-2xl border border-cream-shadow bg-cream-deep p-4 sm:p-5 flex flex-col gap-3 no-underline hover:border-paprika/55 hover:bg-cream-deep/70 transition-colors'

function CloserActions() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6, ease }}
    >
      <div className="flex items-baseline gap-3 mb-6 border-b border-cream-shadow pb-4">
        <h2 className="text-ink text-xl" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>
          Keep cooking
        </h2>
        <span className="ml-auto font-mono text-[0.64rem] uppercase tracking-[0.16em] text-chestnut-soft">Where to next</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {closerTiles.map((t, i) => (
          <motion.div
            key={t.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.44 + i * 0.05, duration: 0.4, ease }}
          >
            {t.to.startsWith('#') ? (
              <a href={t.to} className={closerTileClass}>
                <CloserTileBody icon={t.icon} title={t.title} caption={t.caption} />
              </a>
            ) : (
              <Link to={t.to} className={closerTileClass}>
                <CloserTileBody icon={t.icon} title={t.title} caption={t.caption} />
              </Link>
            )}
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function CloserTileBody({ icon, title, caption }: { icon: string; title: string; caption: string }) {
  return (
    <>
      <span className="text-2xl leading-none" aria-hidden>{icon}</span>
      <span className="flex-1">
        <span className="block font-display text-ink group-hover:text-paprika transition-colors" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {title}
        </span>
        <span className="block text-chestnut-soft text-[0.82rem] leading-snug mt-1">{caption}</span>
      </span>
      <span aria-hidden className="font-mono text-sm text-paprika opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
        →
      </span>
    </>
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

