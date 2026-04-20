const formatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

export function formatAmount(value: number): string {
  return formatter.format(value)
}

export function formatHostname(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} u` : `${h} u ${m}`
}
