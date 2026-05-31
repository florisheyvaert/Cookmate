import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  mealPlanApi,
  MEAL_SLOT_ORDER,
  MEAL_SLOT_LABELS,
  MEAL_SLOT_SHORT,
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
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function todayISO() {
  return toISO(new Date())
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─────────────────────────────────────────────────────────────────────────────

export default function MealPlan() {
  const [view, setView] = useState<View>('week')
  // Anchor is any date inside the visible range.
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(anchor)
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
      return { from: toISO(days[0]), to: toISO(days[6]), days }
    }
    // Month grid: full weeks covering the month, Monday-start.
    const gridStart = startOfWeek(startOfMonth(anchor))
    const monthEnd = endOfMonth(anchor)
    const lastCellDow = (monthEnd.getDay() + 6) % 7
    const gridEnd = addDays(monthEnd, 6 - lastCellDow)
    const count = Math.round((+gridEnd - +gridStart) / 86_400_000) + 1
    const days = Array.from({ length: count }, (_, i) => addDays(gridStart, i))
    return { from: toISO(days[0]), to: toISO(days[days.length - 1]), days }
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
    setAnchor((a) => addDays(a, direction * (view === 'week' ? 7 : 30)))
  }
  function goToday() {
    setAnchor(new Date())
  }

  const periodLabel = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(anchor)
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
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(anchor)
  }, [view, anchor])

  const today = todayISO()
  const anchorMonth = anchor.getMonth()

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
          anchorMonth={anchorMonth}
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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
      {days.map((d, i) => {
        const iso = toISO(d)
        const list = byDate.get(iso) ?? []
        const isToday = iso === today
        return (
          <motion.button
            key={iso}
            type="button"
            onClick={() => onPick(iso)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * i, duration: 0.4, ease }}
            className={[
              'group text-left flex flex-col min-h-[8.5rem] p-3 rounded-sm border transition-colors',
              isToday
                ? 'border-paprika/60 bg-paprika-tint'
                : 'border-cream-shadow bg-cream-deep/30 hover:border-paprika/50 hover:bg-paprika-tint',
            ].join(' ')}
          >
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-chestnut">
                {WEEKDAYS[i]}
              </span>
              <span
                className={[
                  'num text-lg leading-none',
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
  anchorMonth,
  onPick,
}: {
  days: Date[]
  byDate: Map<string, MealEntryDto[]>
  today: string
  anchorMonth: number
  onPick: (iso: string) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-px mb-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-chestnut-soft text-center py-1"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-cream-shadow border border-cream-shadow rounded-sm overflow-hidden">
        {days.map((d) => {
          const iso = toISO(d)
          const list = byDate.get(iso) ?? []
          const isToday = iso === today
          const outside = d.getMonth() !== anchorMonth
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={[
                'group text-left min-h-[5.5rem] md:min-h-[7rem] p-1.5 flex flex-col transition-colors',
                outside ? 'bg-cream/40' : 'bg-cream',
                'hover:bg-paprika-tint',
              ].join(' ')}
            >
              <span
                className={[
                  'num text-[0.82rem] leading-none mb-1 self-end',
                  isToday
                    ? 'text-cream bg-paprika rounded-full w-5 h-5 flex items-center justify-center'
                    : outside
                      ? 'text-chestnut-soft/50'
                      : 'text-ink-soft',
                ].join(' ')}
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {d.getDate()}
              </span>
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
  const isRecipe = entry.recipeId != null
  return (
    <div>
      <span className="block font-mono text-[0.54rem] uppercase tracking-[0.16em] text-chestnut-soft mb-0.5">
        {MEAL_SLOT_LABELS[entry.slot]}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          aria-hidden
          className={[
            'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
            isRecipe ? 'bg-paprika' : 'border border-chestnut-soft',
          ].join(' ')}
        />
        <span
          className="font-display text-ink text-[0.92rem] leading-tight line-clamp-2"
          style={{ fontVariationSettings: '"opsz" 18, "SOFT" 50, "WONK" 0' }}
        >
          {entryLabel(entry)}
        </span>
      </div>
    </div>
  )
}

function MonthChip({ entry }: { entry: MealEntryDto }) {
  const isRecipe = entry.recipeId != null
  return (
    <div
      className={[
        'text-[0.62rem] leading-tight px-1 py-0.5 rounded-sm truncate',
        isRecipe
          ? 'bg-paprika/15 text-paprika-deep'
          : 'bg-cream-deep text-ink-soft',
      ].join(' ')}
      title={`${MEAL_SLOT_LABELS[entry.slot]} — ${entryLabel(entry)}`}
    >
      <span className="font-mono opacity-60">{MEAL_SLOT_SHORT[entry.slot]}</span>{' '}
      {entryLabel(entry)}
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
