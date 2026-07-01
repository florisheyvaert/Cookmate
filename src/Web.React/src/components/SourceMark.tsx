import { useState } from 'react'

/**
 * The same source favicon, but inline — for sitting next to a "From {source}" text
 * link rather than floating in a thumbnail corner. Renders nothing without a favicon.
 */
export function SourceFavicon({
  faviconUrl,
  sourceName,
  className,
}: {
  faviconUrl?: string | null
  sourceName?: string | null
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  if (!faviconUrl || broken) return null
  return (
    <img
      src={faviconUrl}
      alt={sourceName ?? ''}
      loading="lazy"
      className={`inline-block h-3.5 w-3.5 rounded-sm object-contain align-[-2px] ${className ?? ''}`}
      onError={() => setBroken(true)}
    />
  )
}

/**
 * A whisper-quiet source-site logo tucked into the corner of a recipe/dish thumbnail —
 * so you can tell at a glance where a dish came from (Dagelijkse Kost, AH Allerhande…).
 * Renders nothing when there's no favicon (family recipes, unknown hosts) or if the
 * image fails to load, so it never leaves an empty chip behind.
 *
 * Drop it inside a `relative` thumbnail container; it pins itself to a corner.
 */
export function SourceMark({
  faviconUrl,
  sourceName,
  corner = 'bottom-right',
  size = 'md',
  className,
}: {
  faviconUrl?: string | null
  sourceName?: string | null
  corner?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** `sm` for tight thumbnails (list rows, small headers); `md` for photo cards. */
  size?: 'sm' | 'md'
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  if (!faviconUrl || broken) return null

  const pos = {
    'bottom-right': size === 'sm' ? 'bottom-1 right-1' : 'bottom-1.5 right-1.5',
    'bottom-left': size === 'sm' ? 'bottom-1 left-1' : 'bottom-1.5 left-1.5',
    'top-right': size === 'sm' ? 'top-1 right-1' : 'top-1.5 right-1.5',
    'top-left': size === 'sm' ? 'top-1 left-1' : 'top-1.5 left-1.5',
  }[corner]
  const box = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span
      className={`pointer-events-none absolute ${pos} block ${box} overflow-hidden rounded-full bg-cream ring-1 ring-cream/80 shadow-sm ${className ?? ''}`}
      title={sourceName ?? undefined}
    >
      <img
        src={faviconUrl}
        alt={sourceName ?? ''}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    </span>
  )
}
