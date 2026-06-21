import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { recipesApi } from '@/api/recipes'
import { mealPlanApi, MEAL_SLOT_ORDER, MEAL_SLOT_ICON, MEAL_SLOT_LABELS } from '@/api/mealPlan'
import type { MealEntryDto } from '@/api/mealPlan'
import { suggestionsApi } from '@/api/suggestions'
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

      <SuggestedThisWeek />

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
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
      <div className="flex items-end justify-between gap-4 mb-7 flex-wrap">
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
        <div className="flex items-center gap-4">
          <Link to="/suggestions" className={btnGreen}>
            🥗 This week&rsquo;s ideas →
          </Link>
          <Link to="/meal-plan" className={quietLink}>
            Open meal plan →
          </Link>
        </div>
      </div>

      {/* Tonight banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cream-shadow bg-cream-deep mb-4">
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-butter" />
        <div className="p-7 sm:p-9 pl-8 sm:pl-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
          {tonight?.imageUrl && (
            <button
              type="button"
              onClick={() => setSelectedDate(toISO(today))}
              className="shrink-0 block w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-cream-shadow"
            >
              <img src={tonight.imageUrl} alt="" className="w-full h-full object-cover" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-chestnut flex items-center gap-2 mb-2.5">
              <span className="text-butter-deep">Tonight</span>
              <span className="text-chestnut-soft" aria-hidden>
                ·
              </span>
              <span>{wdLong}</span>
            </p>
            {tonight ? (
              <button
                type="button"
                onClick={() => setSelectedDate(toISO(today))}
                className="text-left text-ink leading-tight flex items-baseline gap-2.5 hover:text-paprika transition-colors"
                style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.02em' }}
              >
                <span aria-hidden className="text-[0.8em] leading-none shrink-0" title={MEAL_SLOT_LABELS[tonight.slot]}>
                  {MEAL_SLOT_ICON[tonight.slot]}
                </span>
                <span className="min-w-0 truncate">{entryLabel(tonight)}</span>
              </button>
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
                <button type="button" onClick={() => setSelectedDate(toISO(today))} className={quietLink}>
                  Details
                </button>
              </div>
            ) : (
              <Link to="/meal-plan" className={btnGreen}>
                {tonight ? 'Edit plan' : 'Plan tonight'}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Days ahead — click a day to see what's planned */}
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
              <button
                type="button"
                onClick={() => setSelectedDate(iso)}
                className="group block w-full text-left rounded-xl border border-cream-shadow bg-cream-deep overflow-hidden h-full min-h-[7.25rem] hover:border-paprika/50 transition-colors"
              >
                {head?.imageUrl && (
                  <div className="aspect-[3/2] overflow-hidden bg-cream-shadow/40">
                    <img
                      src={head.imageUrl}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-chestnut">
                      {wdShort.format(d)}
                    </span>
                    <span className="num text-[0.95rem] leading-none text-ink-soft">{d.getDate()}</span>
                  </div>
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

      <DayDetailDialog
        dateIso={selectedDate}
        entries={selectedDate ? byDate.get(selectedDate) ?? [] : []}
        onClose={() => setSelectedDate(null)}
      />
    </motion.section>
  )
}

// ── Day detail — read-only "what's planned" with links to the recipe ─────────

function DayDetailDialog({
  dateIso,
  entries,
  onClose,
}: {
  dateIso: string | null
  entries: MealEntryDto[]
  onClose: () => void
}) {
  const open = dateIso != null

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [open, onClose])

  const title = dateIso ? formatDayLong(dateIso) : ''

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-label={`Meals for ${title}`}
          >
            <div className="w-full max-w-lg bg-cream border border-cream-shadow shadow-[0_28px_70px_-18px_rgba(20,30,18,0.45)] pointer-events-auto rounded-2xl flex flex-col max-h-[88vh] overflow-hidden">
              <header className="px-6 pt-6 pb-4 border-b border-cream-shadow flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-paprika mb-1.5">Planned</p>
                  <h2 className="font-display text-ink text-xl" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="shrink-0 grid place-items-center w-8 h-8 rounded-full border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors"
                >
                  ×
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {entries.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="eyebrow mb-2">Nothing planned</p>
                    <p className="text-ink-soft">This day is still open.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {entries.map((e) => (
                      <div key={e.id} className="rounded-2xl border border-cream-shadow overflow-hidden bg-cream-deep">
                        {e.imageUrl ? (
                          <div className="relative aspect-[16/9] bg-cream-shadow/40">
                            <img src={e.imageUrl} alt="" className="w-full h-full object-cover" />
                            <span className="absolute top-3 left-3">
                              <SlotChip slot={e.slot} onImage />
                            </span>
                          </div>
                        ) : null}

                        <div className="p-4 sm:p-5">
                          {!e.imageUrl && (
                            <div className="mb-2.5">
                              <SlotChip slot={e.slot} />
                            </div>
                          )}
                          <h3 className="font-display text-ink text-xl sm:text-2xl leading-tight" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                            {entryLabel(e)}
                          </h3>
                          {e.recipeId != null && e.servings != null && (
                            <p className="font-mono text-[0.66rem] text-chestnut mt-1">
                              <span className="num text-paprika">{e.servings}</span> servings
                            </p>
                          )}

                          {(e.recipeId != null || (e.notes && isHttpUrl(e.notes))) && (
                            <div className="mt-3.5">
                              {e.recipeId != null ? (
                                <Link
                                  to={`/recipes/${e.recipeId}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 bg-paprika text-cream hover:bg-paprika-deep transition-colors font-mono text-[0.66rem] uppercase tracking-[0.14em] no-underline"
                                >
                                  View recipe →
                                </Link>
                              ) : (
                                e.notes &&
                                isHttpUrl(e.notes) && (
                                  <a
                                    href={e.notes}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors font-mono text-[0.66rem] uppercase tracking-[0.14em]"
                                  >
                                    Open original ↗
                                  </a>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer className="px-6 py-4 border-t border-cream-shadow flex items-center justify-between gap-4">
                <Link to="/meal-plan" className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors">
                  Edit this day →
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
                >
                  Close
                </button>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function SlotChip({ slot, onImage }: { slot: MealEntryDto['slot']; onImage?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em]',
        onImage
          ? 'bg-cream/90 text-ink shadow-sm backdrop-blur-sm'
          : 'bg-paprika/12 text-paprika-deep',
      ].join(' ')}
    >
      <span aria-hidden className="text-sm leading-none">
        {MEAL_SLOT_ICON[slot]}
      </span>
      {MEAL_SLOT_LABELS[slot]}
    </span>
  )
}

function formatDayLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
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
        {days.map((day, i) => (
          <motion.div
            key={day.date}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.04, duration: 0.4, ease }}
            className="rounded-xl border border-cream-shadow bg-cream-deep overflow-hidden flex flex-col"
          >
            <div className="aspect-[4/3] bg-cream-shadow/40 grid place-items-center overflow-hidden">
              {day.suggestion?.imageUrl ? (
                <img src={day.suggestion.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <span aria-hidden className="text-2xl leading-none opacity-60">🍽️</span>
              )}
            </div>
            <div className="p-2.5 flex-1 flex flex-col">
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-chestnut-soft">
                {weekdayShort(day.date)}
              </span>
              {day.suggestion ? (
                <Link
                  to={`/suggestions/${day.suggestion.id}`}
                  className="text-ink text-sm leading-tight mt-0.5 hover:text-paprika transition-colors no-underline line-clamp-2"
                  style={{ fontWeight: 700, letterSpacing: '-0.01em' }}
                >
                  {day.suggestion.title}
                </Link>
              ) : (
                <span className="text-chestnut-soft text-sm mt-0.5">—</span>
              )}
            </div>
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

