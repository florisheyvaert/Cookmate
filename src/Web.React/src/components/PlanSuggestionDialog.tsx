import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  mealPlanApi,
  MealSlots,
  MEAL_SLOT_ORDER,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ICON,
} from '@/api/mealPlan'
import type { MealSlot } from '@/api/mealPlan'

const ease = [0.22, 1, 0.36, 1] as const
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── date helpers (local time, Monday-start week) ─────────────────────────────
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
function startOfWeek(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (r.getDay() + 6) % 7 // 0 = Monday
  return addDays(r, -dow)
}
function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

type Props = {
  open: boolean
  onClose: () => void
  /** Dish title shown and used as the meal's free text. */
  title: string
  /** Source URL kept as the entry note. */
  sourceUrl?: string | null
  /** The harvested suggestion id, so the planned entry can show its photo. */
  suggestionId?: number
  /** Called with the planned day (yyyy-MM-dd) right after a successful add. */
  onPlanned?: (date: string) => void
}

/**
 * Pick any day — across weeks and months — to drop a suggestion onto the meal plan.
 * Stays open after adding so you can schedule several days; days that already have
 * meals show a dot, and the ones you just added are ticked.
 */
export function PlanSuggestionDialog({ open, onClose, title, sourceUrl, suggestionId, onPlanned }: Props) {
  const qc = useQueryClient()
  const [slot, setSlot] = useState<MealSlot>(MealSlots.Dinner)
  const [monthAnchor, setMonthAnchor] = useState(() => firstOfMonth(new Date()))

  useEffect(() => {
    if (!open) return
    setSlot(MealSlots.Dinner)
    setMonthAnchor(firstOfMonth(new Date()))
  }, [open])

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

  const grid = useMemo(() => {
    const start = startOfWeek(monthAnchor)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [monthAnchor])

  const range = { from: toISO(grid[0]), to: toISO(grid[41]) }
  const entriesQ = useQuery({
    queryKey: ['meal-plan', range.from, range.to],
    queryFn: () => mealPlanApi.list(range),
    enabled: open,
  })
  // What's already planned per day — used to label days clearly.
  const plannedByDate = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const e of entriesQ.data ?? []) {
      const label = e.recipeId != null ? e.recipeTitle ?? 'Recipe' : e.freeText ?? ''
      const list = m.get(e.date)
      if (list) list.push(label)
      else m.set(e.date, [label])
    }
    return m
  }, [entriesQ.data])

  const create = useMutation({
    mutationFn: (iso: string) =>
      mealPlanApi.create({
        date: iso,
        slot,
        recipeId: null,
        freeText: title,
        servings: null,
        notes: sourceUrl ?? null,
        suggestionId: suggestionId ?? null,
      }),
    onSuccess: (_data, iso) => {
      qc.invalidateQueries({ queryKey: ['meal-plan'] })
      onPlanned?.(iso)
      onClose()
    },
  })

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthAnchor)
  const today = toISO(new Date())

  function stepMonth(dir: number) {
    setMonthAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1))
  }

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
            aria-label={`Add ${title} to the plan`}
          >
            <div className="w-full max-w-lg bg-cream border border-cream-shadow shadow-[0_28px_70px_-18px_rgba(20,30,18,0.45)] pointer-events-auto rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <header className="px-6 pt-6 pb-4 border-b border-cream-shadow flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow text-paprika mb-1.5">Add to plan</p>
                  <h2 className="font-display text-ink text-xl leading-tight line-clamp-2" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
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

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Slot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MEAL_SLOT_ORDER.map((s) => {
                    const active = s === slot
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={[
                          'flex items-center justify-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] px-2.5 py-2.5 border rounded-lg transition-colors',
                          active ? 'bg-paprika text-cream border-paprika' : 'text-chestnut border-cream-shadow hover:border-paprika hover:text-paprika',
                        ].join(' ')}
                      >
                        <span aria-hidden className="text-sm leading-none">{MEAL_SLOT_ICON[s]}</span>
                        <span className="truncate">{MEAL_SLOT_LABELS[s]}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Month navigation */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <NavArrow direction={-1} onClick={() => stepMonth(-1)} label="Previous month" />
                    <NavArrow direction={1} onClick={() => stepMonth(1)} label="Next month" />
                  </div>
                  <h3 className="font-display text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {monthLabel}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMonthAnchor(firstOfMonth(new Date()))}
                    className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
                  >
                    Today
                  </button>
                </div>

                {/* Calendar */}
                <div>
                  <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map((w) => (
                      <div key={w} className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-chestnut-soft text-center py-1">
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {grid.map((d) => {
                      const iso = toISO(d)
                      const inMonth = d.getMonth() === monthAnchor.getMonth()
                      const isToday = iso === today
                      const planned = plannedByDate.get(iso) ?? []
                      const hasMeals = planned.length > 0
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => create.mutate(iso)}
                          disabled={create.isPending}
                          className={[
                            'relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors disabled:opacity-60',
                            hasMeals
                              ? 'bg-paprika/15 ring-1 ring-inset ring-paprika/40 text-paprika-deep hover:bg-paprika/25'
                              : isToday
                                ? 'ring-1 ring-inset ring-paprika/50 text-ink hover:bg-paprika-tint'
                                : inMonth
                                  ? 'text-ink hover:bg-paprika-tint'
                                  : 'text-chestnut-soft/50 hover:bg-paprika-tint',
                          ].join(' ')}
                          title={
                            hasMeals
                              ? `Already planned: ${planned.join(', ')}\nClick to add another`
                              : `Add to ${MEAL_SLOT_LABELS[slot]}`
                          }
                        >
                          <span
                            className={['num text-[0.92rem] leading-none', hasMeals ? 'font-semibold' : ''].join(' ')}
                            style={{ fontFeatureSettings: '"tnum"' }}
                          >
                            {d.getDate()}
                          </span>
                          {hasMeals && (
                            <span
                              aria-hidden
                              className="absolute top-0.5 right-0.5 min-w-[0.95rem] h-[0.95rem] px-1 rounded-full bg-paprika text-cream font-mono text-[0.56rem] leading-none flex items-center justify-center"
                            >
                              {planned.length}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-2 mt-3 font-mono text-[0.6rem] text-chestnut-soft">
                    <span className="inline-block w-3 h-3 rounded-sm bg-paprika/15 ring-1 ring-inset ring-paprika/40" />
                    <span>day already has a meal planned (number = how many)</span>
                  </div>
                </div>
              </div>

              <footer className="px-6 py-4 border-t border-cream-shadow flex items-center justify-between gap-4">
                <span className="font-mono text-[0.66rem] text-chestnut">Pick a day to plan it</span>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
                >
                  Cancel
                </button>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function NavArrow({ direction, onClick, label }: { direction: number; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center font-mono text-chestnut border border-cream-shadow rounded-md hover:border-paprika hover:text-paprika transition-colors"
    >
      {direction < 0 ? '←' : '→'}
    </button>
  )
}
