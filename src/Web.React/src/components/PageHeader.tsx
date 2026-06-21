import type { ReactNode } from 'react'
import { motion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

type PageHeaderProps = {
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  /** Optional right-aligned action (e.g. a primary button). */
  action?: ReactNode
}

/**
 * Shared page masthead. Keeps the eyebrow + title (and optional action /
 * subtitle) at the exact same position and size on every page, so titles line
 * up across Recipes, Meal Plan, Shop, Users, …
 */
export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="mb-10 md:mb-14">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow mb-3">{eyebrow}</p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease }}
            className="text-ink"
            style={{ fontSize: 'clamp(2.4rem, 6vw, 4.8rem)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.035em' }}
          >
            {title}
          </motion.h1>
        </div>
        {/* On mobile the action stretches full-width (centered) so it reads as a
            deliberate button instead of a stray link under the title; on sm+ it
            shrinks back to its content width. Targets the action's root element. */}
        {action && (
          <div className="w-full sm:w-auto shrink-0 mt-1 [&>*]:w-full [&>*]:justify-center sm:[&>*]:w-auto">
            {action}
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-ink-soft text-lg leading-relaxed mt-4 max-w-2xl">{subtitle}</p>
      )}
    </header>
  )
}
