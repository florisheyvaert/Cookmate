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
import { ApiError } from '@/lib/api'

const ease = [0.22, 1, 0.36, 1] as const

type View = 'menu' | 'recipe' | 'text'
type PickedRecipe = { id: number; title: string; baseServings?: number; image?: string | null }

type Props = {
  open: boolean
  /** yyyy-MM-dd */
  date: string
  entries: MealEntryDto[]
  /** Future + today are editable; past days are view-only. */
  editable: boolean
  onClose: () => void
}

/**
 * The day planner. A small multi-step dialog: the menu lists what's planned and
 * offers three ways to add a meal — from a recipe, from this week's ideas
 * (navigates to the Ideas page), or as free text. Recipe + free text open as
 * sub-steps inside the same card. Past days show the meals read-only.
 */
export function DayPlannerDialog({ open, date, entries, editable, onClose }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('menu')
  const [slot, setSlot] = useState<MealSlot>(MealSlots.Dinner)
  const [recipe, setRecipe] = useState<PickedRecipe | null>(null)
  const [servings, setServings] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function resetSub() {
    setSlot(MealSlots.Dinner)
    setRecipe(null)
    setServings(null)
    setText('')
    setError(null)
  }
  function backToMenu() {
    setView('menu')
    resetSub()
  }

  useEffect(() => {
    if (open) {
      setView('menu')
      resetSub()
    }
  }, [open, date])

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (view === 'menu') onClose()
        else backToMenu()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [open, onClose, view])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['meal-plan'] })

  const create = useMutation({
    mutationFn: (payload: Parameters<typeof mealPlanApi.create>[0]) => mealPlanApi.create(payload),
    onSuccess: async () => {
      await invalidate()
      backToMenu()
    },
    onError: (err) => setError(extractError(err)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => mealPlanApi.remove(id),
    onSuccess: invalidate,
    onError: (err) => setError(extractError(err)),
  })

  function addRecipe() {
    if (!recipe) {
      setError('Pick a recipe first.')
      return
    }
    create.mutate({ date, slot, recipeId: recipe.id, freeText: null, servings, notes: null })
  }
  function addText() {
    if (!text.trim()) {
      setError('Type what you’re eating.')
      return
    }
    create.mutate({ date, slot, recipeId: null, freeText: text.trim(), servings: null, notes: null })
  }
  function goToIdeas() {
    onClose()
    navigate('/suggestions')
  }

  const dayTitle = useMemo(() => formatDay(date), [date])

  const headerEyebrow =
    view === 'recipe' ? 'Add · from a recipe'
    : view === 'text' ? 'Add · free text'
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
                  {view !== 'menu' && (
                    <button
                      type="button"
                      onClick={backToMenu}
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

              {view === 'menu' && (
                <MenuView
                  entries={entries}
                  editable={editable}
                  onDelete={(id) => remove.mutate(id)}
                  onPickRecipe={() => setView('recipe')}
                  onPickText={() => setView('text')}
                  onPickIdeas={goToIdeas}
                  error={error}
                />
              )}

              {view === 'recipe' && (
                <SubView
                  footer={
                    <SubmitButton
                      onClick={addRecipe}
                      disabled={recipe == null || create.isPending}
                      label={create.isPending ? 'Adding…' : 'Add to day'}
                    />
                  }
                  error={error}
                >
                  <SlotSelector value={slot} onChange={setSlot} />
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
                </SubView>
              )}

              {view === 'text' && (
                <SubView
                  footer={
                    <SubmitButton
                      onClick={addText}
                      disabled={text.trim().length === 0 || create.isPending}
                      label={create.isPending ? 'Adding…' : 'Add to day'}
                    />
                  }
                  error={error}
                >
                  <SlotSelector value={slot} onChange={setSlot} />
                  <div>
                    <p className="eyebrow mb-2">What are you eating?</p>
                    <FreeTextField value={text} onChange={setText} />
                  </div>
                </SubView>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Menu view ─────────────────────────────────────────────────────────────────

function MenuView({
  entries,
  editable,
  onDelete,
  onPickRecipe,
  onPickText,
  onPickIdeas,
  error,
}: {
  entries: MealEntryDto[]
  editable: boolean
  onDelete: (id: number) => void
  onPickRecipe: () => void
  onPickText: () => void
  onPickIdeas: () => void
  error: string | null
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-6 space-y-7">
      {/* Planned */}
      <div>
        <p className="eyebrow mb-2.5">Planned</p>
        {entries.length === 0 ? (
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

      {/* Add controls */}
      {editable ? (
        <div>
          <p className="eyebrow mb-3">Add a meal</p>
          <div className="space-y-2.5">
            <AddTile icon="🍲" title="From a recipe" caption="Search your saved recipes" onClick={onPickRecipe} />
            <AddTile icon="🥗" title="From this week’s ideas" caption="Opens this week’s ideas" external onClick={onPickIdeas} />
            <AddTile icon="✏️" title="As free text" caption="Leftovers, takeaway, a quick note" onClick={onPickText} />
          </div>
        </div>
      ) : (
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-chestnut-soft">
          This day is in the past — view only.
        </p>
      )}
    </div>
  )
}

function AddTile({
  icon,
  title,
  caption,
  external,
  onClick,
}: {
  icon: string
  title: string
  caption: string
  external?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left flex items-center gap-3.5 rounded-xl border border-cream-shadow bg-cream-deep/40 px-4 py-3.5 hover:border-paprika/55 hover:bg-paprika-tint transition-colors"
    >
      <span className="text-2xl leading-none shrink-0" aria-hidden>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-ink group-hover:text-paprika transition-colors" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {title}
        </span>
        <span className="block font-mono text-[0.58rem] uppercase tracking-[0.13em] text-chestnut-soft mt-0.5">{caption}</span>
      </span>
      <span aria-hidden className="shrink-0 font-mono text-sm text-chestnut group-hover:text-paprika transition-colors">
        {external ? '↗' : '→'}
      </span>
    </button>
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

// ── Slot selector ─────────────────────────────────────────────────────────────

function SlotSelector({ value, onChange }: { value: MealSlot; onChange: (s: MealSlot) => void }) {
  return (
    <div>
      <p className="eyebrow mb-2">Type</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MEAL_SLOT_ORDER.map((slot) => {
          const active = slot === value
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onChange(slot)}
              className={[
                'flex items-center justify-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] px-2.5 py-2.5 border rounded-lg transition-colors',
                active ? 'bg-paprika text-cream border-paprika' : 'text-chestnut border-cream-shadow hover:border-paprika hover:text-paprika',
              ].join(' ')}
            >
              <span aria-hidden className="text-sm leading-none">{MEAL_SLOT_ICON[slot]}</span>
              <span className="truncate">{MEAL_SLOT_LABELS[slot]}</span>
            </button>
          )
        })}
      </div>
    </div>
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
