import type { ReactNode } from 'react'

/**
 * The header of one integrations group (Recipe sources / Promotions). A tinted icon
 * chip gives each group an instantly distinct identity, with a display-font title,
 * a one-line description, and room for a right-aligned action (e.g. "Add source").
 */
export function GroupHeader({
  icon,
  tint,
  title,
  description,
  action,
}: {
  icon: string
  tint: 'paprika' | 'butter'
  title: string
  description: string
  action?: ReactNode
}) {
  const chip = tint === 'butter' ? 'bg-butter/20 text-butter-deep' : 'bg-paprika/12 text-paprika-deep'
  return (
    <div className="flex items-start gap-3.5">
      <span className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 text-lg leading-none ${chip}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-ink text-lg sm:text-xl leading-tight" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          {title}
        </h3>
        <p className="text-ink-soft text-sm leading-relaxed mt-1">{description}</p>
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  )
}
