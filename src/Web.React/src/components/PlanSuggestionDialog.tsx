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
import type { MealEntryDto, MealSlot } from '@/api/mealPlan'
import { addDays, startOfWeek, toISO } from '@/lib/calendarDates'

const ease = [0.22, 1, 0.36, 1] as const
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type Props = {
  open: boolean
  onClose: () => void
  /** Dish title shown and used as the meal's free text. */
  title: string
  /** Source URL kept as the entry note. */
  sourceUrl?: string | null
  /** The harvested suggestion id, so the planned entry can show its photo. */
  suggestionId?: number
  /** Default servings for the planned meal (the suggestion's base servings). */
  baseServings?: number
  /** The dish photo, shown so you can see what you're planning. */
  imageUrl?: string | null
  /** Called with the planned day (yyyy-MM-dd) right after a successful add. */
  onPlanned?: (date: string) => void
}

/**
 * Drop a suggestion onto the plan. A calm week strip (paged with the carousel
 * arrows) shows each day's photo — both what's already planned and, up top, the
 * dish you're adding. It's a dinner at the usual servings unless you open Options.
 */
export function PlanSuggestionDialog({
  open,
  onClose,
  title,
  sourceUrl,
  suggestionId,
  baseServings,
  imageUrl,
  onPlanned,
}: Props) {
  const qc = useQueryClient()
  const [slot, setSlot] = useState<MealSlot>(MealSlots.Dinner)
  const [servings, setServings] = useState(baseServings ?? 4)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showOptions, setShowOptions] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSlot(MealSlots.Dinner)
    setServings(baseServings ?? 4)
    setWeekStart(startOfWeek(new Date()))
    setShowOptions(false)
    setSelectedDate(null)
  }, [open, baseServings])

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

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const range = { from: toISO(days[0]), to: toISO(days[6]) }
  const entriesQ = useQuery({
    queryKey: ['meal-plan', range.from, range.to],
    queryFn: () => mealPlanApi.list(range),
    enabled: open,
  })

  // What's already planned per day, dinner-first, so each tile can show its photo.
  const byDate = useMemo(() => {
    const m = new Map<string, MealEntryDto[]>()
    for (const e of entriesQ.data ?? []) {
      const list = m.get(e.date)
      if (list) list.push(e)
      else m.set(e.date, [e])
    }
    for (const list of m.values()) {
      list.sort((a, b) => MEAL_SLOT_ORDER.indexOf(a.slot) - MEAL_SLOT_ORDER.indexOf(b.slot))
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
        servings: suggestionId != null ? servings : null,
        notes: sourceUrl ?? null,
        suggestionId: suggestionId ?? null,
      }),
    onSuccess: (_data, iso) => {
      qc.invalidateQueries({ queryKey: ['meal-plan'] })
      onPlanned?.(iso)
      onClose()
    },
  })

  const today = toISO(new Date())
  const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
  const weekLabel = `${fmt.format(days[0])} – ${fmt.format(days[6])}`
  const atThisWeek = toISO(weekStart) === toISO(startOfWeek(new Date()))
  const stepWeek = (dir: number) => setWeekStart((w) => addDays(w, dir * 7))

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
            <div className="w-full max-w-xl bg-cream border border-cream-shadow shadow-[0_28px_70px_-18px_rgba(20,30,18,0.45)] pointer-events-auto rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">
              {/* Header — the dish you're planning, with its photo */}
              <header className="px-6 pt-5 pb-4 border-b border-cream-shadow flex items-start gap-4">
                <DishThumb url={imageUrl ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-paprika mb-1.5">Add to plan</p>
                  <h2 className="font-display text-ink text-lg leading-tight line-clamp-2" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {title}
                  </h2>
                  <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-chestnut-soft">
                    {MEAL_SLOT_LABELS[slot]}
                    {suggestionId != null && <span className="num"> · {servings} serves</span>}
                  </p>
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

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Week navigation */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <NavArrow direction={-1} onClick={() => stepWeek(-1)} label="Previous week" />
                    <NavArrow direction={1} onClick={() => stepWeek(1)} label="Next week" />
                    <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink ml-1">{weekLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeekStart(startOfWeek(new Date()))}
                    disabled={atThisWeek}
                    className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors disabled:opacity-30 disabled:hover:text-chestnut"
                  >
                    ↺ This week
                  </button>
                </div>

                {/* Week strip — pick a day; each tile shows what's already there */}
                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((d, i) => {
                    const iso = toISO(d)
                    const list = byDate.get(iso) ?? []
                    const head = list[0] ?? null
                    const isToday = iso === today
                    const isPast = iso < today
                    const isSelected = iso === selectedDate
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        disabled={isPast || create.isPending}
                        title={list.length > 0 ? `${list.length} planned · add another` : `Plan on ${iso}`}
                        className={[
                          'group flex flex-col rounded-lg border overflow-hidden transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                          isSelected
                            ? 'border-paprika ring-2 ring-inset ring-paprika/40'
                            : isToday
                              ? 'border-paprika/60 ring-1 ring-inset ring-paprika/30'
                              : 'border-cream-shadow hover:border-paprika/55',
                        ].join(' ')}
                      >
                        <span className={['px-1 py-1 text-center leading-none', isSelected || isToday ? 'bg-paprika text-cream' : 'bg-cream-deep'].join(' ')}>
                          <span className="block font-mono text-[0.5rem] uppercase tracking-[0.1em] opacity-80">{WEEKDAYS[i]}</span>
                          <span className="block num text-[0.82rem] mt-0.5">{d.getDate()}</span>
                        </span>
                        <span className="relative aspect-square bg-cream-shadow/25 grid place-items-center overflow-hidden">
                          {head?.imageUrl ? (
                            <img src={head.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                          ) : list.length > 0 ? (
                            <span aria-hidden className="text-sm leading-none opacity-50">🍽️</span>
                          ) : (
                            <span aria-hidden className="font-mono text-base leading-none text-chestnut-soft/60 group-hover:text-paprika transition-colors">＋</span>
                          )}
                          {list.length > 1 && (
                            <span className="absolute top-0.5 right-0.5 min-w-[0.85rem] h-[0.85rem] px-0.5 rounded-full bg-paprika text-cream font-mono text-[0.5rem] leading-none flex items-center justify-center">
                              {list.length}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Options — collapsed by default; it's usually dinner at the same servings */}
                <div className="rounded-xl border border-cream-shadow overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowOptions((v) => !v)}
                    aria-expanded={showOptions}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-cream-deep/50 transition-colors"
                  >
                    <span aria-hidden className="text-chestnut-soft">⚙</span>
                    <span className="flex-1 eyebrow">Options</span>
                    <span className="font-mono text-[0.62rem] text-chestnut-soft normal-case tracking-normal">
                      {MEAL_SLOT_LABELS[slot]}
                      {suggestionId != null && ` · ${servings} serves`}
                    </span>
                    <span className="shrink-0 text-chestnut-soft">
                      <Chevron open={showOptions} />
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {showOptions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 border-t border-cream-shadow space-y-4">
                          <div>
                            <p className="eyebrow mb-2">Type</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {MEAL_SLOT_ORDER.map((s) => {
                                const active = s === slot
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setSlot(s)}
                                    className={[
                                      'flex items-center justify-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] px-2.5 py-2 border rounded-lg transition-colors',
                                      active ? 'bg-paprika text-cream border-paprika' : 'text-chestnut border-cream-shadow hover:border-paprika hover:text-paprika',
                                    ].join(' ')}
                                  >
                                    <span aria-hidden className="text-sm leading-none">{MEAL_SLOT_ICON[s]}</span>
                                    <span className="truncate">{MEAL_SLOT_LABELS[s]}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {suggestionId != null && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="eyebrow">Servings</span>
                              <span className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setServings((v) => Math.max(1, v - 1))}
                                  disabled={servings <= 1}
                                  aria-label="Fewer servings"
                                  className="w-7 h-7 grid place-items-center rounded-md font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors disabled:opacity-30"
                                >
                                  −
                                </button>
                                <span className="num text-paprika text-base min-w-[1.6rem] text-center">{servings}</span>
                                <button
                                  type="button"
                                  onClick={() => setServings((v) => v + 1)}
                                  aria-label="More servings"
                                  className="w-7 h-7 grid place-items-center rounded-md font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors"
                                >
                                  +
                                </button>
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <footer className="px-6 py-4 border-t border-cream-shadow flex items-center justify-between gap-4">
                <span className="font-mono text-[0.66rem] text-chestnut min-w-0 truncate">
                  {selectedDate ? (
                    <>
                      Planning <span className="text-paprika">{formatDay(selectedDate)}</span>
                    </>
                  ) : (
                    'Pick a day to plan it'
                  )}
                </span>
                <div className="flex items-center gap-4 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    // Re-mounts when the chosen day changes, so it pops each time it lights up.
                    key={selectedDate ?? 'none'}
                    type="button"
                    initial={{ scale: selectedDate ? 0.9 : 1 }}
                    animate={{ scale: selectedDate ? [0.9, 1.07, 1] : 1 }}
                    transition={{ duration: 0.3, ease }}
                    onClick={() => selectedDate && create.mutate(selectedDate)}
                    disabled={!selectedDate || create.isPending}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 font-display font-semibold text-[0.9rem] transition-colors',
                      selectedDate
                        ? 'bg-paprika text-cream hover:bg-paprika-deep shadow-[0_6px_18px_-6px_rgba(47,125,79,0.6)]'
                        : 'bg-cream-shadow/60 text-chestnut-soft cursor-not-allowed',
                    ].join(' ')}
                  >
                    {create.isPending ? 'Planning…' : 'Plan'}
                    {selectedDate && !create.isPending && <span aria-hidden>→</span>}
                  </motion.button>
                </div>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d))
}

function DishThumb({ url }: { url: string | null }) {
  return (
    <span className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-cream-shadow bg-cream-deep grid place-items-center">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden className="text-xl leading-none opacity-50">🍽️</span>
      )}
    </span>
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
      {direction < 0 ? '‹' : '›'}
    </button>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
