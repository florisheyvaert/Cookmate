import { useMemo } from 'react'
import { useSwipe } from '@/lib/useSwipe'
import { firstOfMonth, monthGrid, toISO } from '@/lib/calendarDates'

// Monday-start week, matching PlanSuggestionDialog.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type Props = {
  /** First-of-month anchor for the visible month (controlled). */
  month: Date
  onMonthChange: (next: Date) => void
  onPick: (iso: string) => void
  /** iso → number of meals already planned that day (drives the count badge). */
  plannedByDate?: Map<string, number>
  /** Highlighted day (e.g. the one being planned in the wizard). */
  selected?: string | null
  /** When set, past days are inert (used by the planner wizard — you plan forward). */
  disablePast?: boolean
}

/**
 * A month calendar grid in the cookbook style: past days fade + blur, today
 * lights up paprika, weekends carry the warm butter tint, and days that already
 * have meals show a count badge. Pages through months (arrows, Today, or swipe).
 */
export function MonthCalendar({ month, onMonthChange, onPick, plannedByDate, selected, disablePast }: Props) {
  const grid = useMemo(() => monthGrid(month), [month])
  const today = toISO(new Date())

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)
  const stepMonth = (dir: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + dir, 1))
  const swipe = useSwipe(() => stepMonth(1), () => stepMonth(-1))

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <NavArrow direction={-1} onClick={() => stepMonth(-1)} label="Previous month" />
          <NavArrow direction={1} onClick={() => stepMonth(1)} label="Next month" />
        </div>
        <h3 className="font-display text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          {monthLabel}
        </h3>
        <button
          type="button"
          onClick={() => onMonthChange(firstOfMonth(new Date()))}
          className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors"
        >
          Today
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={[
              'font-mono text-[0.56rem] uppercase tracking-[0.12em] text-center py-1',
              i >= 5 ? 'text-butter-deep' : 'text-chestnut-soft',
            ].join(' ')}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1 touch-pan-y" {...swipe}>
        {grid.map((d) => {
          const iso = toISO(d)
          const inMonth = d.getMonth() === month.getMonth()
          const isToday = iso === today
          const isPast = iso < today
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const isSelected = selected != null && iso === selected
          const count = plannedByDate?.get(iso) ?? 0
          const inert = disablePast === true && isPast

          const tone = isSelected
            ? 'bg-paprika text-cream ring-1 ring-inset ring-paprika'
            : count > 0
              ? 'bg-paprika/15 ring-1 ring-inset ring-paprika/40 text-paprika-deep hover:bg-paprika/25'
              : isToday
                ? 'bg-paprika-tint ring-1 ring-inset ring-paprika/60 text-paprika font-semibold hover:bg-paprika/15'
                : isWeekend
                  ? 'bg-butter-tint text-butter-deep hover:bg-butter/20'
                  : inMonth
                    ? 'text-ink hover:bg-paprika-tint'
                    : 'text-chestnut-soft/45 hover:bg-paprika-tint'

          return (
            <button
              key={iso}
              type="button"
              disabled={inert}
              onClick={() => onPick(iso)}
              className={[
                'relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors',
                tone,
                isPast ? 'opacity-45 blur-[1px] hover:opacity-100 hover:blur-0' : '',
                inert ? 'pointer-events-none hover:opacity-45 hover:blur-[1px]' : '',
              ].join(' ')}
              title={count > 0 ? `${count} planned` : undefined}
            >
              <span className="num text-[0.92rem] leading-none" style={{ fontFeatureSettings: '"tnum"' }}>
                {d.getDate()}
              </span>
              {count > 0 && !isSelected && (
                <span
                  aria-hidden
                  className="absolute top-0.5 right-0.5 min-w-[0.95rem] h-[0.95rem] px-1 rounded-full bg-paprika text-cream font-mono text-[0.56rem] leading-none flex items-center justify-center"
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
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
