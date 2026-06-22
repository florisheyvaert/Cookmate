import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { mealPlanApi, MEAL_SLOT_ICON, MEAL_SLOT_LABELS, MEAL_SLOT_ORDER } from '@/api/mealPlan'
import type { MealEntryDto } from '@/api/mealPlan'
import { MonthCalendar } from '@/components/MonthCalendar'
import { firstOfMonth, monthGrid, toISO } from '@/lib/calendarDates'
import { DayPlannerDialog } from '@/components/DayPlannerDialog'

const ease = [0.22, 1, 0.36, 1] as const

function sortBySlot(a: MealEntryDto, b: MealEntryDto) {
  return MEAL_SLOT_ORDER.indexOf(a.slot) - MEAL_SLOT_ORDER.indexOf(b.slot)
}

/**
 * The full-month planning calendar — the place to browse and plan any day beyond
 * the home page's three-day window. Click a day to open its planner.
 */
export default function Calendar() {
  const [month, setMonth] = useState(() => firstOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const grid = useMemo(() => monthGrid(month), [month])
  const from = toISO(grid[0])
  const to = toISO(grid[41])

  const entriesQ = useQuery({ queryKey: ['meal-plan', from, to], queryFn: () => mealPlanApi.list({ from, to }) })

  // iso → meals that day (count drives the calendar badges; list feeds the rail).
  const byDate = useMemo(() => {
    const m = new Map<string, MealEntryDto[]>()
    for (const e of entriesQ.data ?? []) {
      const list = m.get(e.date)
      if (list) list.push(e)
      else m.set(e.date, [e])
    }
    for (const list of m.values()) list.sort(sortBySlot)
    return m
  }, [entriesQ.data])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const [iso, list] of byDate) m.set(iso, list.length)
    return m
  }, [byDate])

  // Days of the visible month that have meals — a calm summary beside the grid.
  const plannedDays = useMemo(() => {
    return grid
      .filter((d) => d.getMonth() === month.getMonth() && (byDate.get(toISO(d))?.length ?? 0) > 0)
      .map((d) => ({ iso: toISO(d), date: d, meals: byDate.get(toISO(d)) ?? [] }))
  }, [grid, month, byDate])

  const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' })

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-12 md:pt-20 pb-28">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-10 flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <p className="eyebrow text-paprika mb-2">Meal plan</p>
          <h1 className="text-ink" style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em' }}>
            The calendar
          </h1>
        </div>
        <Link
          to="/"
          className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors no-underline"
        >
          ← Back home
        </Link>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-[23rem_19rem] gap-8 lg:gap-12 items-start">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5, ease }}
          className="rounded-2xl border border-cream-shadow bg-cream-deep p-5 sm:p-7"
        >
          <MonthCalendar month={month} onMonthChange={setMonth} onPick={setSelectedDate} plannedByDate={counts} />

          {/* Legend */}
          <div className="flex items-center gap-4 mt-5 font-mono text-[0.58rem] text-chestnut-soft flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-paprika/15 ring-1 ring-inset ring-paprika/40" /> has meals
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-paprika-tint ring-1 ring-inset ring-paprika/60" /> today
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-butter-tint" /> weekend
            </span>
          </div>
        </motion.div>

        {/* This month's planned meals */}
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.5, ease }}
        >
          <h2 className="font-display text-ink text-lg mb-4" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            Planned this month
          </h2>
          {plannedDays.length === 0 ? (
            <p className="text-ink-soft text-sm">Nothing planned yet. Pick a day to start.</p>
          ) : (
            <ul className="space-y-2.5">
              {plannedDays.map(({ iso, date, meals }) => (
                <li key={iso}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    className="w-full text-left rounded-xl border border-cream-shadow bg-cream-deep px-4 py-3 hover:border-paprika/55 hover:bg-paprika-tint transition-colors flex items-center gap-3"
                  >
                    <span className="num text-paprika text-sm shrink-0 w-11">{fmtDay.format(date)}</span>
                    <span className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span aria-hidden className="text-sm leading-none shrink-0" title={MEAL_SLOT_LABELS[meals[0].slot]}>
                        {MEAL_SLOT_ICON[meals[0].slot]}
                      </span>
                      <span className="text-ink text-sm truncate">
                        {meals[0].recipeId != null ? meals[0].recipeTitle : meals[0].freeText}
                        {meals.length > 1 && <span className="text-chestnut-soft"> +{meals.length - 1}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.aside>
      </div>

      <DayPlannerDialog open={selectedDate != null} initialDate={selectedDate} onClose={() => setSelectedDate(null)} />
    </div>
  )
}
