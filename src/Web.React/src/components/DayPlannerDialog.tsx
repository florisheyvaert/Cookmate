import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import {
  mealPlanApi,
  MealSlots,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
  MEAL_SLOT_ICON,
} from '@/api/mealPlan'
import type { MealEntryDto, MealSlot } from '@/api/mealPlan'
import { MonthCalendar } from '@/components/MonthCalendar'
import { firstOfMonth } from '@/lib/calendarDates'
import { ApiError } from '@/lib/api'

const ease = [0.22, 1, 0.36, 1] as const

// Wizard steps. `date` only appears when no day was pre-selected (the generic
// "Plan a meal" entry point). `menu` is the day overview; `slot` asks "as what?";
// `assign` picks the actual meal (a recipe or free text).
type View = 'date' | 'menu' | 'slot' | 'assign'
type AssignMode = 'recipe' | 'text'
type PickedRecipe = { id: number; title: string; baseServings?: number; image?: string | null }

type Props = {
  open: boolean
  /** yyyy-MM-dd to plan straight away, or null to start the wizard at date-pick. */
  initialDate?: string | null
  onClose: () => void
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function todayISO() {
  const n = new Date()
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`
}

/**
 * The day planner, as a small wizard. Without a date it opens on a month
 * calendar (pick a day → pick a type → assign a meal). With a date it opens on
 * the day overview, where you can add more or delete. Past days are view-only.
 */
export function DayPlannerDialog({ open, initialDate = null, onClose }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const today = todayISO()

  const [activeDate, setActiveDate] = useState<string | null>(initialDate)
  const [view, setView] = useState<View>(initialDate ? 'menu' : 'date')
  const [monthAnchor, setMonthAnchor] = useState(() => firstOfMonth(new Date()))

  const [slot, setSlot] = useState<MealSlot>(MealSlots.Dinner)
  const [mode, setMode] = useState<AssignMode>('recipe')
  const [recipe, setRecipe] = useState<PickedRecipe | null>(null)
  const [servings, setServings] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // The day is editable when it's today or later; past days are read-only.
  const editable = activeDate != null && activeDate >= today

  function resetSub() {
    setSlot(MealSlots.Dinner)
    setMode('recipe')
    setRecipe(null)
    setServings(null)
    setText('')
    setError(null)
  }

  // Reset the whole wizard whenever it (re)opens.
  useEffect(() => {
    if (!open) return
    setActiveDate(initialDate)
    setView(initialDate ? 'menu' : 'date')
    setMonthAnchor(firstOfMonth(new Date()))
    resetSub()
  }, [open, initialDate])

  // Entries for the active day — fetched here so both entry points stay simple.
  const entriesQ = useQuery({
    queryKey: ['meal-plan', activeDate, activeDate],
    queryFn: () => mealPlanApi.list({ from: activeDate!, to: activeDate! }),
    enabled: open && activeDate != null,
  })
  const entries = useMemo(() => sortBySlot(entriesQ.data ?? []), [entriesQ.data])

  // The step you go back to depends on where this wizard started.
  function prevView(v: View): View | null {
    if (v === 'assign') return 'slot'
    if (v === 'slot') return initialDate ? 'menu' : 'date'
    if (v === 'menu') return initialDate ? null : 'date'
    return null // date
  }
  function goBack() {
    const prev = prevView(view)
    if (prev == null) {
      onClose()
      return
    }
    setError(null)
    if (prev !== 'assign') resetSub()
    setView(prev)
  }

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, activeDate])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['meal-plan'] })

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof mealPlanApi.create>[0]) => mealPlanApi.create(payload),
    onSuccess: async () => {
      await invalidate()
      resetSub()
      setView('menu') // land on the day overview so the new meal is visible
    },
    onError: (err) => setError(extractError(err)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => mealPlanApi.remove(id),
    onSuccess: invalidate,
    onError: (err) => setError(extractError(err)),
  })

  function pickDate(iso: string) {
    setActiveDate(iso)
    // Future/today → straight into the wizard. Past day → its read-only overview.
    setView(iso >= today ? 'slot' : 'menu')
  }

  function submit() {
    if (!activeDate) return
    if (mode === 'recipe') {
      if (!recipe) {
        setError('Pick a recipe first.')
        return
      }
      create.mutate({ date: activeDate, slot, recipeId: recipe.id, freeText: null, servings, notes: null })
    } else {
      if (!text.trim()) {
        setError('Type what you’re eating.')
        return
      }
      create.mutate({ date: activeDate, slot, recipeId: null, freeText: text.trim(), servings: null, notes: null })
    }
  }

  function goToIdeas() {
    onClose()
    navigate('/suggestions')
  }

  const isRoot = prevView(view) == null
  const dayTitle = activeDate ? formatDay(activeDate) : 'Plan a meal'
  const headerEyebrow =
    view === 'date' ? 'Step 1 · pick a day'
    : view === 'slot' ? 'Step 2 · as what?'
    : view === 'assign' ? `Step 3 · ${MEAL_SLOT_LABELS[slot].toLowerCase()}`
    : editable ? 'Plan the day'
    : 'Past day · view only'

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
            aria-label={`Meals for ${dayTitle}`}
          >
            <div className="w-full max-w-md bg-cream border border-cream-shadow shadow-[0_28px_70px_-18px_rgba(20,30,18,0.45)] pointer-events-auto rounded-2xl flex flex-col max-h-[88vh] overflow-hidden">
              <header className="px-6 sm:px-7 pt-6 pb-4 border-b border-cream-shadow flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {!isRoot && (
                    <button
                      type="button"
                      onClick={goBack}
                      aria-label="Back"
                      className="shrink-0 grid place-items-center w-8 h-8 mt-0.5 rounded-full border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors"
                    >
                      ←
                    </button>
                  )}
                  <div className="min-w-0">
                    <p className="eyebrow text-paprika mb-1.5">{headerEyebrow}</p>
                    <h2 className="font-display text-ink text-xl sm:text-2xl leading-tight" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                      {dayTitle}
                    </h2>
                  </div>
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

              {view === 'date' && (
                <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-6">
                  <MonthCalendar month={monthAnchor} onMonthChange={setMonthAnchor} onPick={pickDate} disablePast />
                  <p className="mt-4 font-mono text-[0.62rem] text-chestnut-soft text-center">Pick a day to plan it</p>
                </div>
              )}

              {view === 'menu' && (
                <MenuView
                  entries={entries}
                  loading={entriesQ.isPending && activeDate != null}
                  editable={editable}
                  onDelete={(id) => remove.mutate(id)}
                  onAdd={() => {
                    resetSub()
                    setView('slot')
                  }}
                  onPickIdeas={goToIdeas}
                  error={error}
                />
              )}

              {view === 'slot' && <SlotStep value={slot} onPick={(s) => { setSlot(s); setView('assign') }} />}

              {view === 'assign' && (
                <SubView
                  footer={
                    <SubmitButton
                      onClick={submit}
                      disabled={(mode === 'recipe' ? recipe == null : text.trim().length === 0) || create.isPending}
                      label={create.isPending ? 'Adding…' : 'Add to day'}
                    />
                  }
                  error={error}
                >
                  <ModeToggle value={mode} onChange={(m) => { setMode(m); setError(null) }} />
                  {mode === 'recipe' ? (
                    <RecipeField
                      recipe={recipe}
                      servings={servings}
                      onPick={(r) => {
                        setRecipe(r)
                        setServings(r.baseServings ?? null)
                      }}
                      onClear={() => {
                        setRecipe(null)
                        setServings(null)
                      }}
                      onServings={setServings}
                    />
                  ) : (
                    <div>
                      <p className="eyebrow mb-2">What are you eating?</p>
                      <FreeTextField value={text} onChange={setText} />
                    </div>
                  )}
                  <IdeasTile onClick={goToIdeas} />
                </SubView>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function sortBySlot(entries: MealEntryDto[]) {
  return [...entries].sort((a, b) => MEAL_SLOT_ORDER.indexOf(a.slot) - MEAL_SLOT_ORDER.indexOf(b.slot))
}

// ── Menu view (day overview) ─────────────────────────────────────────────────

function MenuView({
  entries,
  loading,
  editable,
  onDelete,
  onAdd,
  onPickIdeas,
  error,
}: {
  entries: MealEntryDto[]
  loading: boolean
  editable: boolean
  onDelete: (id: number) => void
  onAdd: () => void
  onPickIdeas: () => void
  error: string | null
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-6 space-y-7">
      <div>
        <p className="eyebrow mb-2.5">Planned</p>
        {loading ? (
          <p className="font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-ink-soft">Nothing planned yet.</p>
        ) : (
          <ul className="divide-y divide-cream-shadow border-y border-cream-shadow">
            {entries.map((e) => (
              <li key={e.id} className="py-3.5 flex items-center gap-3">
                <span aria-hidden className="text-lg leading-none shrink-0" title={MEAL_SLOT_LABELS[e.slot]}>
                  {MEAL_SLOT_ICON[e.slot]}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display text-ink leading-tight truncate" style={{ fontWeight: 600 }}>
                    {e.recipeId != null ? e.recipeTitle : e.freeText}
                  </span>
                  <span className="block font-mono text-[0.58rem] uppercase tracking-[0.14em] text-chestnut-soft">
                    {MEAL_SLOT_LABELS[e.slot]}
                    {e.recipeId != null && e.servings != null && <span className="num"> · {e.servings}p</span>}
                  </span>
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => onDelete(e.id)}
                    aria-label="Delete meal"
                    className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-chestnut hover:bg-paprika/10 hover:text-paprika-deep transition-colors"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="font-mono text-[0.72rem] text-paprika-deep">{error}</p>}

      {editable ? (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onAdd}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 bg-paprika text-cream font-display font-semibold text-[0.95rem] leading-none hover:bg-paprika-deep transition-colors"
          >
            <span aria-hidden className="text-base leading-none">＋</span> Add a meal
          </button>
          <IdeasTile onClick={onPickIdeas} />
        </div>
      ) : (
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-chestnut-soft">
          This day is in the past — view only.
        </p>
      )}
    </div>
  )
}

// A clear, tappable shortcut to this week's scraped ideas (leaves the dialog).
function IdeasTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left flex items-center gap-3.5 rounded-xl border border-cream-shadow bg-cream-deep/40 px-4 py-3.5 hover:border-paprika/55 hover:bg-paprika-tint transition-colors"
    >
      <span aria-hidden className="text-2xl leading-none shrink-0">🥗</span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-ink group-hover:text-paprika transition-colors" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          This week’s ideas
        </span>
        <span className="block font-mono text-[0.58rem] uppercase tracking-[0.13em] text-chestnut-soft mt-0.5">
          Fresh picks from your sources
        </span>
      </span>
      <span aria-hidden className="shrink-0 font-mono text-sm text-chestnut group-hover:text-paprika transition-colors">↗</span>
    </button>
  )
}

// ── Slot step ("as what?") ───────────────────────────────────────────────────

function SlotStep({ value, onPick }: { value: MealSlot; onPick: (s: MealSlot) => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-6">
      <div className="grid grid-cols-2 gap-3">
        {MEAL_SLOT_ORDER.map((s) => {
          const active = s === value
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className={[
                'flex flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-7 transition-colors',
                active
                  ? 'border-paprika bg-paprika-tint'
                  : 'border-cream-shadow bg-cream-deep/40 hover:border-paprika/55 hover:bg-paprika-tint',
              ].join(' ')}
            >
              <span aria-hidden className="text-3xl leading-none">{MEAL_SLOT_ICON[s]}</span>
              <span className="font-display text-ink" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                {MEAL_SLOT_LABELS[s]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Assign step: recipe / free-text toggle ───────────────────────────────────

function ModeToggle({ value, onChange }: { value: AssignMode; onChange: (m: AssignMode) => void }) {
  const opts: { value: AssignMode; icon: string; label: string }[] = [
    { value: 'recipe', icon: '🍲', label: 'From a recipe' },
    { value: 'text', icon: '✏️', label: 'Free text' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              'flex items-center justify-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.12em] px-3 py-2.5 border rounded-lg transition-colors',
              active ? 'bg-paprika text-cream border-paprika' : 'text-chestnut border-cream-shadow hover:border-paprika hover:text-paprika',
            ].join(' ')}
          >
            <span aria-hidden className="text-sm leading-none">{o.icon}</span>
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Sub-view shell (scroll body + sticky footer) ─────────────────────────────

function SubView({ children, footer, error }: { children: ReactNode; footer: ReactNode; error: string | null }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-6 space-y-6">{children}</div>
      <footer className="px-6 sm:px-7 py-5 border-t border-cream-shadow space-y-3">
        {error && <p className="font-mono text-[0.72rem] text-paprika-deep">{error}</p>}
        {footer}
      </footer>
    </>
  )
}

function SubmitButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 bg-paprika text-cream font-display font-semibold text-[0.95rem] leading-none hover:bg-paprika-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
      <span aria-hidden>→</span>
    </button>
  )
}

// ── Recipe field (search + pick + servings) ──────────────────────────────────

function RecipeField({
  recipe,
  servings,
  onPick,
  onClear,
  onServings,
}: {
  recipe: PickedRecipe | null
  servings: number | null
  onPick: (r: PickedRecipe) => void
  onClear: () => void
  onServings: (n: number) => void
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220)
    return () => clearTimeout(t)
  }, [query])

  const results = useQuery({
    queryKey: ['recipes', 'meal-pick', debounced],
    queryFn: () => recipesApi.list(debounced.trim() ? { search: debounced } : undefined),
    enabled: recipe == null,
    staleTime: 30_000,
  })

  if (recipe) {
    return (
      <div className="flex items-center gap-3 p-3 border border-paprika/30 bg-paprika-tint rounded-xl">
        <RecipeThumb url={recipe.image ?? null} />
        <span className="flex-1 min-w-0 font-display text-ink truncate" style={{ fontWeight: 600 }}>
          {recipe.title}
        </span>
        <ServingsStepper value={servings ?? recipe.baseServings ?? 2} onChange={onServings} />
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors shrink-0"
        >
          change
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="eyebrow mb-2">Your recipes</p>
      <div className="relative">
        <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 text-chestnut-soft text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your recipes…"
          className="w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 pl-6 font-mono text-sm text-ink placeholder:text-chestnut-soft transition-colors"
        />
      </div>
      <div className="mt-2 max-h-52 overflow-y-auto">
        {results.isPending ? (
          <p className="font-mono text-[0.66rem] text-chestnut-soft py-2">Loading your recipes…</p>
        ) : results.isError ? (
          <p className="font-mono text-[0.66rem] text-paprika-deep py-2">Couldn’t load recipes.</p>
        ) : results.data.length === 0 ? (
          <p className="font-mono text-[0.66rem] text-chestnut-soft py-2">No recipes match.</p>
        ) : (
          <ul className="space-y-0.5">
            {results.data.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick({ id: r.id, title: r.title, baseServings: r.baseServings, image: r.coverImageUrl })}
                  className="w-full text-left px-2 py-2 hover:bg-paprika-tint rounded-lg transition-colors flex items-center gap-3"
                >
                  <RecipeThumb url={r.coverImageUrl} />
                  <span className="flex-1 min-w-0 font-display text-ink text-[0.95rem] truncate" style={{ fontWeight: 600 }}>
                    {r.title}
                  </span>
                  <span className="num text-[0.66rem] text-chestnut-soft shrink-0">{r.baseServings}p</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function RecipeThumb({ url }: { url: string | null }) {
  return (
    <span className="w-9 h-9 shrink-0 rounded-md overflow-hidden bg-cream-deep border border-cream-shadow grid place-items-center">
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span aria-hidden className="text-chestnut-soft text-sm leading-none">🍽️</span>}
    </span>
  )
}

function ServingsStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Fewer servings"
        className="w-6 h-6 flex items-center justify-center rounded-md font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors disabled:opacity-30"
      >
        −
      </button>
      <span className="num text-paprika text-base min-w-[1.4rem] text-center" style={{ fontFeatureSettings: '"tnum"' }}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="More servings"
        className="w-6 h-6 flex items-center justify-center rounded-md font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors"
      >
        +
      </button>
    </div>
  )
}

// ── Free-text field (with autocomplete from history) ─────────────────────────

function FreeTextField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [debounced, setDebounced] = useState(value)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 200)
    return () => clearTimeout(t)
  }, [value])

  const suggestions = useQuery({
    queryKey: ['meal-plan', 'suggestions', debounced.trim()],
    queryFn: () => mealPlanApi.suggestions(debounced.trim() || undefined),
    staleTime: 30_000,
  })

  const filtered = (suggestions.data ?? []).filter((s) => s.toLowerCase() !== value.trim().toLowerCase())

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder="e.g. spaghetti, leftovers, takeaway…"
        className="w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 font-mono text-sm text-ink placeholder:text-chestnut-soft transition-colors"
      />
      {focused && filtered.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-chestnut-soft self-center">Again?</span>
          {filtered.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(s)
              }}
              className="font-mono text-[0.66rem] px-2 py-1 border border-cream-shadow rounded-lg text-ink-soft hover:border-paprika hover:text-paprika transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; detail?: string; title?: string } | null
    const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    return first ?? body?.detail ?? body?.title ?? `Request failed (HTTP ${err.status}).`
  }
  return 'Something went wrong.'
}
