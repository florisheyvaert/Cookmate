import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  mealPlanApi,
  MEAL_SLOT_ORDER,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_ICON,
} from '@/api/mealPlan'
import type { MealEntryDto } from '@/api/mealPlan'
import { MealEntryDialog } from '@/components/MealEntryDialog'

const ease = [0.22, 1, 0.36, 1] as const

type View = 'week' | 'month'

// ── date helpers (local time, Monday-start week — Belgium) ──────────────────

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
function todayISO() {
  return toISO(new Date())
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ─────────────────────────────────────────────────────────────────────────────

export default function MealPlan() {
  const [view, setView] = useState<View>('week')
  // Anchor is any date inside the visible range.
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const range = useMemo(() => {
    if (view === 'week') {
      // Rolling 7-day window starting at the anchor day (today by default).
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
      return { from: toISO(days[0]), to: toISO(days[6]), days }
    }
    // Rolling 4-week window, week-aligned (Monday start) — advances one week at
    // a time, so you slide weeks 1–4 → 2–5 → … instead of jumping a whole month.
    const gridStart = startOfWeek(anchor)
    const days = Array.from({ length: 28 }, (_, i) => addDays(gridStart, i))
    return { from: toISO(days[0]), to: toISO(days[27]), days }
  }, [view, anchor])

  const entries = useQuery({
    queryKey: ['meal-plan', range.from, range.to],
    queryFn: () => mealPlanApi.list({ from: range.from, to: range.to }),
  })

  const byDate = useMemo(() => {
    const map = new Map<string, MealEntryDto[]>()
    for (const e of entries.data ?? []) {
      const list = map.get(e.date)
      if (list) list.push(e)
      else map.set(e.date, [e])
    }
    // Dinner first within a day.
    for (const list of map.values()) {
      list.sort(
        (a, b) => MEAL_SLOT_ORDER.indexOf(a.slot) - MEAL_SLOT_ORDER.indexOf(b.slot),
      )
    }
    return map
  }, [entries.data])

  function step(direction: number) {
    // Week view slides one day at a time; month view jumps a full week.
    setAnchor((a) => addDays(a, direction * (view === 'week' ? 1 : 7)))
  }
  function goToday() {
    setAnchor(new Date())
  }

  const periodLabel = useMemo(() => {
    if (view === 'week') {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
      const end = addDays(start, 6)
      const sameMonth = start.getMonth() === end.getMonth()
      const fmtDay = new Intl.DateTimeFormat(undefined, { day: 'numeric' })
      const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'long' })
      const fmtMonthYear = new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
      })
      return sameMonth
        ? `${fmtDay.format(start)}–${fmtDay.format(end)} ${fmtMonthYear.format(end)}`
        : `${fmtDay.format(start)} ${fmtMonth.format(start)} – ${fmtDay.format(end)} ${fmtMonthYear.format(end)}`
    }
    const mStart = startOfWeek(anchor)
    const mEnd = addDays(mStart, 27)
    const fmtDay = new Intl.DateTimeFormat(undefined, { day: 'numeric' })
    const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'short' })
    const fmtMonthYear = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
    return `${fmtDay.format(mStart)} ${fmtMonth.format(mStart)} – ${fmtDay.format(mEnd)} ${fmtMonthYear.format(mEnd)}`
  }, [view, anchor])

  const today = todayISO()

  return (
    <div className="px-6 md:px-12 lg:px-20 pt-8 pb-16 grain min-h-[80vh]">
      <header className="mb-8 pb-4 border-b border-cream-shadow">
        <p className="eyebrow mb-2">Cookbook · Meal Plan</p>
        <h1
          className="font-display text-ink"
          style={{
            fontSize: 'clamp(2.4rem, 6vw, 4.6rem)',
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
          }}
        >
          What's cooking.
        </h1>
        <p className="font-display text-ink-soft text-base md:text-lg mt-3 max-w-2xl">
          Pin a recipe or jot a quick note to any day — spaghetti from the freezer counts too.
        </p>
      </header>

      {/* Controls */}
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-4">
          <div className="flex items-center gap-1.5">
            <NavArrow direction={-1} onClick={() => step(-1)} label="Previous" />
            <NavArrow direction={1} onClick={() => step(1)} label="Next" />
          </div>
          <h2
            className="font-display text-ink text-xl md:text-2xl"
            style={{
              fontVariationSettings: '"opsz" 60, "SOFT" 40, "WONK" 0',
              letterSpacing: '-0.02em',
            }}
          >
            {periodLabel}
          </h2>
          <button
            type="button"
            onClick={goToday}
            className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors"
          >
            Today
          </button>
        </div>

        <ViewToggle value={view} onChange={setView} />
      </div>

      {entries.isError && (
        <p className="mb-6 font-mono text-[0.72rem] text-paprika-deep">
          Couldn't load the plan. Refresh to try again.
        </p>
      )}

      {view === 'week' ? (
        <WeekView
          days={range.days}
          byDate={byDate}
          today={today}
          onPick={setSelectedDate}
        />
      ) : (
        <MonthView
          days={range.days}
          byDate={byDate}
          today={today}
          onPick={setSelectedDate}
        />
      )}

      <MealEntryDialog
        open={selectedDate != null}
        date={selectedDate ?? today}
        entries={selectedDate ? byDate.get(selectedDate) ?? [] : []}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  )
}

// ── Week view ───────────────────────────────────────────────────────────────

function WeekView({
  days,
  byDate,
  today,
  onPick,
}: {
  days: Date[]
  byDate: Map<string, MealEntryDto[]>
  today: string
  onPick: (iso: string) => void
}) {
  const wd = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
      {days.map((d, i) => {
        const iso = toISO(d)
        const list = byDate.get(iso) ?? []
        const isToday = iso === today
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        return (
          <motion.button
            key={iso}
            type="button"
            onClick={() => onPick(iso)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * i, duration: 0.4, ease }}
            className={[
              'group text-left flex flex-col min-h-[8.5rem] p-3 rounded-sm border transition-colors hover:border-paprika/50 hover:bg-paprika-tint',
              isToday
                ? 'border-paprika/70 bg-paprika-tint ring-1 ring-inset ring-paprika/40'
                : isWeekend
                  ? 'border-cream-shadow bg-butter-tint'
                  : 'border-cream-shadow bg-cream-deep/30',
            ].join(' ')}
          >
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span
                className={[
                  'font-mono text-[0.6rem] uppercase tracking-[0.12em] truncate min-w-0',
                  isToday ? 'text-paprika' : 'text-chestnut',
                ].join(' ')}
              >
                {isToday ? 'Today' : wd.format(d)}
              </span>
              <span
                className={[
                  'num text-lg leading-none shrink-0',
                  isToday ? 'text-paprika' : 'text-ink-soft',
                ].join(' ')}
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {d.getDate()}
              </span>
            </div>

            <div className="flex-1 space-y-1.5">
              {list.length === 0 ? (
                <span className="font-mono text-[0.62rem] text-chestnut-soft/70 opacity-0 group-hover:opacity-100 transition-opacity">
                  + add a meal
                </span>
              ) : (
                list.map((e) => <EntryChip key={e.id} entry={e} />)
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  days,
  byDate,
  today,
  onPick,
}: {
  days: Date[]
  byDate: Map<string, MealEntryDto[]>
  today: string
  onPick: (iso: string) => void
}) {
  const mfmt = new Intl.DateTimeFormat(undefined, { month: 'short' })
  return (
    <div>
      <div className="grid grid-cols-7 gap-px mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-chestnut-soft text-center py-1 truncate"
          >
            <span className="hidden md:inline">{WEEKDAYS_FULL[i]}</span>
            <span className="md:hidden">{w}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-cream-shadow border border-cream-shadow rounded-sm overflow-hidden">
        {days.map((d) => {
          const iso = toISO(d)
          const list = byDate.get(iso) ?? []
          const isToday = iso === today
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const firstOfMonth = d.getDate() === 1
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={[
                'group text-left min-h-[5.5rem] md:min-h-[7rem] p-1.5 flex flex-col transition-colors hover:bg-paprika-tint',
                isToday
                  ? 'bg-paprika-tint ring-1 ring-inset ring-paprika/50'
                  : isWeekend
                    ? 'bg-butter-tint'
                    : 'bg-cream',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-1 min-h-[1.25rem]">
                {isToday ? (
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-paprika leading-none">
                    Today
                  </span>
                ) : firstOfMonth ? (
                  <span className="font-mono text-[0.52rem] uppercase tracking-[0.1em] text-chestnut-soft leading-none">
                    {mfmt.format(d)}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={[
                    'num text-[0.82rem] leading-none',
                    isToday
                      ? 'text-cream bg-paprika rounded-full w-5 h-5 flex items-center justify-center'
                      : 'text-ink-soft',
                  ].join(' ')}
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {list.slice(0, 3).map((e) => (
                  <MonthChip key={e.id} entry={e} />
                ))}
                {list.length > 3 && (
                  <span className="font-mono text-[0.56rem] text-chestnut-soft">
                    +{list.length - 3} more
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function entryLabel(entry: MealEntryDto) {
  return entry.recipeId != null
    ? entry.recipeTitle ?? 'Recipe'
    : entry.freeText ?? ''
}

function EntryChip({ entry }: { entry: MealEntryDto }) {
  return (
    <div className="flex items-start gap-1.5" title={`${MEAL_SLOT_LABELS[entry.slot]} — ${entryLabel(entry)}`}>
      <span aria-hidden className="text-base leading-snug shrink-0">
        {MEAL_SLOT_ICON[entry.slot]}
      </span>
      <span className="font-display text-ink text-[1rem] leading-snug line-clamp-2">
        {entryLabel(entry)}
      </span>
    </div>
  )
}

function MonthChip({ entry }: { entry: MealEntryDto }) {
  const isRecipe = entry.recipeId != null
  return (
    <div
      className={[
        'flex items-center gap-1 text-[0.72rem] leading-tight px-1 py-0.5 rounded-sm',
        isRecipe
          ? 'bg-paprika/15 text-paprika-deep'
          : 'bg-cream-deep text-ink-soft',
      ].join(' ')}
      title={`${MEAL_SLOT_LABELS[entry.slot]} — ${entryLabel(entry)}`}
    >
      <span aria-hidden className="text-[0.95rem] leading-none shrink-0">{MEAL_SLOT_ICON[entry.slot]}</span>
      <span className="truncate">{entryLabel(entry)}</span>
    </div>
  )
}

function NavArrow({
  direction,
  onClick,
  label,
}: {
  direction: number
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center font-mono text-chestnut border border-cream-shadow rounded-sm hover:border-paprika hover:text-paprika transition-colors"
    >
      {direction < 0 ? '←' : '→'}
    </button>
  )
}

function ViewToggle({
  value,
  onChange,
}: {
  value: View
  onChange: (v: View) => void
}) {
  const options: { value: View; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ]
  return (
    <div className="inline-flex items-center gap-0.5 border border-chestnut/30 rounded-sm p-0.5 bg-cream-deep/40">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={[
              'px-3 py-1 font-mono uppercase tracking-[0.16em] text-[0.62rem] transition-colors rounded-sm',
              active ? 'bg-paprika text-cream' : 'text-chestnut hover:text-paprika',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
