import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import {
  mealPlanApi,
  MealSlots,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ORDER,
} from '@/api/mealPlan'
import type { MealEntryDto, MealSlot } from '@/api/mealPlan'
import { ApiError } from '@/lib/api'

const ease = [0.22, 1, 0.36, 1] as const

type Mode = 'recipe' | 'text'

type PickedRecipe = { id: number; title: string; baseServings?: number }

type Draft = {
  id: number | null
  slot: MealSlot
  mode: Mode
  recipe: PickedRecipe | null
  servings: number | null
  text: string
  notes: string
}

function emptyDraft(): Draft {
  return {
    id: null,
    slot: MealSlots.Dinner,
    mode: 'recipe',
    recipe: null,
    servings: null,
    text: '',
    notes: '',
  }
}

function draftFromEntry(e: MealEntryDto): Draft {
  const isRecipe = e.recipeId != null
  return {
    id: e.id,
    slot: e.slot,
    mode: isRecipe ? 'recipe' : 'text',
    recipe: isRecipe ? { id: e.recipeId!, title: e.recipeTitle ?? 'Recipe' } : null,
    servings: e.servings,
    text: e.freeText ?? '',
    notes: e.notes ?? '',
  }
}

type Props = {
  open: boolean
  date: string // yyyy-MM-dd
  entries: MealEntryDto[]
  onClose: () => void
}

export function MealEntryDialog({ open, date, entries, onClose }: Props) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  // Reset the form whenever the dialog opens on a (new) day.
  useEffect(() => {
    if (open) {
      setDraft(emptyDraft())
      setError(null)
    }
  }, [open, date])

  // Scroll-lock + Escape.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [open, onClose])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['meal-plan'] })

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const payload = {
        date,
        slot: d.slot,
        recipeId: d.mode === 'recipe' ? d.recipe!.id : null,
        freeText: d.mode === 'text' ? d.text.trim() : null,
        servings: d.mode === 'recipe' ? d.servings : null,
        notes: d.notes.trim() || null,
      }
      return d.id == null
        ? mealPlanApi.create(payload).then(() => undefined)
        : mealPlanApi.update({ ...payload, id: d.id })
    },
    onSuccess: async () => {
      await invalidate()
      setDraft(emptyDraft())
      setError(null)
    },
    onError: (err) => setError(extractError(err)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => mealPlanApi.remove(id),
    onSuccess: invalidate,
    onError: (err) => setError(extractError(err)),
  })

  function submit() {
    if (draft.mode === 'recipe' && !draft.recipe) {
      setError('Pick a recipe or switch to free text.')
      return
    }
    if (draft.mode === 'text' && !draft.text.trim()) {
      setError('Type what you’re eating.')
      return
    }
    save.mutate(draft)
  }

  const dayTitle = useMemo(() => formatDay(date), [date])

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
            className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-label={`Meals for ${dayTitle}`}
          >
            <div className="grain w-full max-w-md bg-cream border border-chestnut/30 shadow-[0_24px_60px_-12px_rgba(26,20,16,0.35)] pointer-events-auto rounded-sm flex flex-col max-h-[88vh]">
              <header className="px-6 pt-6 pb-4 border-b border-cream-shadow">
                <p className="eyebrow mb-2">Plan the day</p>
                <h2
                  className="font-display text-ink text-2xl"
                  style={{
                    fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {dayTitle}
                </h2>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Existing entries */}
                {entries.length > 0 && (
                  <ul className="divide-y divide-cream-shadow -mt-1">
                    {entries.map((e) => (
                      <li key={e.id} className="py-2.5 flex items-center gap-3">
                        <span className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-chestnut w-16 shrink-0">
                          {MEAL_SLOT_LABELS[e.slot]}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className="block font-display text-ink leading-tight truncate"
                            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                          >
                            {e.recipeId != null ? e.recipeTitle : e.freeText}
                            {e.recipeId != null && e.servings != null && (
                              <span className="num text-chestnut-soft text-[0.8rem]">
                                {' '}· {e.servings}p
                              </span>
                            )}
                          </span>
                          {e.notes && (
                            <span className="block font-mono text-[0.62rem] text-chestnut-soft truncate">
                              {e.notes}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDraft(draftFromEntry(e))}
                          className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove.mutate(e.id)}
                          aria-label="Delete entry"
                          className="font-mono text-paprika/70 hover:text-paprika-deep transition-colors"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Editor */}
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <p className="eyebrow text-paprika">
                      {draft.id == null ? 'Add a meal' : 'Edit meal'}
                    </p>
                    {draft.id != null && (
                      <button
                        type="button"
                        onClick={() => setDraft(emptyDraft())}
                        className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
                      >
                        + new instead
                      </button>
                    )}
                  </div>

                  <SlotSelector
                    value={draft.slot}
                    onChange={(slot) => setDraft((d) => ({ ...d, slot }))}
                  />

                  <ModeTabs
                    value={draft.mode}
                    onChange={(mode) => setDraft((d) => ({ ...d, mode }))}
                  />

                  {draft.mode === 'recipe' ? (
                    <RecipeField
                      recipe={draft.recipe}
                      servings={draft.servings}
                      onPick={(recipe) =>
                        setDraft((d) => ({
                          ...d,
                          recipe,
                          servings: recipe.baseServings ?? d.servings,
                        }))
                      }
                      onClear={() =>
                        setDraft((d) => ({ ...d, recipe: null, servings: null }))
                      }
                      onServings={(servings) => setDraft((d) => ({ ...d, servings }))}
                    />
                  ) : (
                    <FreeTextField
                      value={draft.text}
                      onChange={(text) => setDraft((d) => ({ ...d, text }))}
                    />
                  )}

                  <input
                    type="text"
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    placeholder="Note (optional) — e.g. sauce from the freezer"
                    className="w-full bg-transparent border-0 border-b border-cream-shadow focus:border-paprika focus:outline-none py-1.5 font-mono text-[0.72rem] text-ink placeholder:text-chestnut-soft transition-colors"
                  />

                  {error && (
                    <p className="font-mono text-[0.7rem] text-paprika-deep">{error}</p>
                  )}

                  <button
                    type="button"
                    onClick={submit}
                    disabled={save.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.72rem] hover:bg-paprika transition-colors disabled:opacity-60"
                  >
                    {save.isPending
                      ? 'Saving…'
                      : draft.id == null
                        ? 'Add to day'
                        : 'Save changes'}
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>

              <footer className="px-6 py-3 border-t border-cream-shadow flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
                >
                  Done
                </button>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Slot selector ─────────────────────────────────────────────────────────────

function SlotSelector({
  value,
  onChange,
}: {
  value: MealSlot
  onChange: (s: MealSlot) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MEAL_SLOT_ORDER.map((slot) => {
        const active = slot === value
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onChange(slot)}
            className={[
              'font-mono text-[0.62rem] uppercase tracking-[0.16em] px-2.5 py-1 border rounded-sm transition-colors',
              active
                ? 'bg-paprika text-cream border-paprika'
                : 'text-chestnut border-cream-shadow hover:border-paprika hover:text-paprika',
            ].join(' ')}
          >
            {MEAL_SLOT_LABELS[slot]}
          </button>
        )
      })}
    </div>
  )
}

// ── Mode tabs ─────────────────────────────────────────────────────────────────

function ModeTabs({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const tabs: { value: Mode; label: string }[] = [
    { value: 'recipe', label: 'Recipe' },
    { value: 'text', label: 'Free text' },
  ]
  return (
    <div className="flex border-b border-cream-shadow">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={[
              'font-mono text-[0.66rem] uppercase tracking-[0.18em] px-3 py-2 -mb-px border-b-2 transition-colors',
              active
                ? 'border-paprika text-paprika'
                : 'border-transparent text-chestnut hover:text-paprika',
            ].join(' ')}
          >
            {t.label}
          </button>
        )
      })}
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
      <div className="flex items-center gap-3 flex-wrap p-2.5 border border-paprika/30 bg-paprika-tint rounded-sm">
        <span
          className="flex-1 min-w-0 font-display text-ink truncate"
          style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
        >
          {recipe.title}
        </span>
        <ServingsStepper
          value={servings ?? recipe.baseServings ?? 2}
          baseServings={recipe.baseServings}
          onChange={onServings}
        />
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
        >
          change
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your recipes…"
        className="w-full bg-transparent border-0 border-b-2 border-chestnut/40 focus:border-paprika focus:outline-none py-2 font-mono text-sm text-ink placeholder:text-chestnut-soft transition-colors"
      />
      <div className="mt-2 max-h-44 overflow-y-auto">
        {results.isPending ? (
          <p className="font-mono text-[0.66rem] text-chestnut-soft py-2">Loading…</p>
        ) : results.isError ? (
          <p className="font-mono text-[0.66rem] text-paprika-deep py-2">
            Couldn’t load recipes.
          </p>
        ) : results.data.length === 0 ? (
          <p className="font-mono text-[0.66rem] text-chestnut-soft py-2">
            No recipes match.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {results.data.slice(0, 12).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() =>
                    onPick({ id: r.id, title: r.title, baseServings: r.baseServings })
                  }
                  className="w-full text-left px-2 py-1.5 hover:bg-paprika-tint rounded-sm transition-colors flex items-baseline justify-between gap-2"
                >
                  <span
                    className="font-display text-ink text-[0.95rem] truncate"
                    style={{ fontVariationSettings: '"opsz" 20, "SOFT" 50, "WONK" 0' }}
                  >
                    {r.title}
                  </span>
                  <span className="num text-[0.66rem] text-chestnut-soft shrink-0">
                    {r.baseServings}p
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ServingsStepper({
  value,
  baseServings,
  onChange,
}: {
  value: number
  baseServings?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Fewer servings"
        className="w-6 h-6 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors disabled:opacity-30"
      >
        −
      </button>
      <span
        className="num text-paprika text-base min-w-[1.4rem] text-center"
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
      {baseServings != null && value !== baseServings && (
        <button
          type="button"
          onClick={() => onChange(baseServings)}
          className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-chestnut-soft hover:text-paprika transition-colors"
        >
          ↺ {baseServings}
        </button>
      )}
    </div>
  )
}

// ── Free-text field (with autocomplete from history) ─────────────────────────

function FreeTextField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
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

  const filtered = (suggestions.data ?? []).filter(
    (s) => s.toLowerCase() !== value.trim().toLowerCase(),
  )

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder="e.g. spaghetti, leftovers, takeaway…"
        className="w-full bg-transparent border-0 border-b-2 border-chestnut/40 focus:border-paprika focus:outline-none py-2 font-mono text-sm text-ink placeholder:text-chestnut-soft transition-colors"
      />
      {focused && filtered.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-chestnut-soft self-center">
            Again?
          </span>
          {filtered.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(s)
              }}
              className="font-mono text-[0.66rem] px-2 py-1 border border-cream-shadow rounded-sm text-ink-soft hover:border-paprika hover:text-paprika transition-colors"
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
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as {
      errors?: Record<string, string[]>
      detail?: string
      title?: string
    } | null
    const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    return first ?? body?.detail ?? body?.title ?? `Request failed (HTTP ${err.status}).`
  }
  return 'Something went wrong.'
}
