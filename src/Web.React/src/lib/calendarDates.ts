// Local-time date helpers for the meal-plan calendars (Monday-start weeks).

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function startOfWeek(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (r.getDay() + 6) % 7 // 0 = Monday
  return addDays(r, -dow)
}

export function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** The 42 cells (6 weeks, Monday-start) covering the month `anchor` sits in. */
export function monthGrid(anchor: Date) {
  const start = startOfWeek(firstOfMonth(anchor))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
