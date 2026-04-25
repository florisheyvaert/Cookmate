import type { RecipeIngredientDto } from '@/api/types'
import { formatAmount } from '@/lib/format'

/**
 * The "mise" caption that sits above a step body — annotated margin in the
 * cookbook tradition. On mobile each ingredient gets its own row (amount+unit
 * in a narrow column, name aligned on the right) so long lists stay scannable.
 * From md up it collapses back to a dot-separated inline line to preserve the
 * page rhythm on wider screens.
 */
export function MiseLine({
  ingredients,
  factor,
  size = 'sm',
}: {
  ingredients: RecipeIngredientDto[]
  factor: number
  size?: 'sm' | 'md' | 'lg'
}) {
  if (ingredients.length === 0) return null

  const inlineSizing =
    size === 'lg' ? 'text-lg md:text-xl' : size === 'md' ? 'text-base md:text-lg' : 'text-sm'

  const stack =
    size === 'lg'
      ? { row: 'gap-x-4', amount: 'text-base', unit: 'text-[0.68rem]', name: 'text-lg', col: '3.75rem' }
      : size === 'md'
        ? { row: 'gap-x-3', amount: 'text-sm', unit: 'text-[0.62rem]', name: 'text-base', col: '3.5rem' }
        : { row: 'gap-x-3', amount: 'text-[0.82rem]', unit: 'text-[0.58rem]', name: 'text-[0.92rem]', col: '3.25rem' }

  return (
    <div className="mb-3 border-l-2 border-paprika/60 pl-3">
      {/* Mobile: stacked rows — amount·unit on the left, name on the right. */}
      <ul className={`md:hidden space-y-1`}>
        {ingredients.map((ing) => {
          const scaled = ing.amount * factor
          const hasAmount = scaled > 0
          return (
            <li
              key={ing.id}
              className={`grid items-baseline ${stack.row} leading-snug`}
              style={{ gridTemplateColumns: `${stack.col} 1fr` }}
            >
              <span className="text-right">
                {hasAmount ? (
                  <>
                    <span
                      className={`num text-paprika tabular-nums ${stack.amount}`}
                      style={{ fontFeatureSettings: '"tnum"' }}
                    >
                      {formatAmount(scaled)}
                    </span>
                    {ing.unit && (
                      <span className={`font-mono uppercase tracking-[0.12em] text-chestnut ml-1 ${stack.unit}`}>
                        {ing.unit}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-chestnut-soft" aria-hidden>·</span>
                )}
              </span>
              <span
                className={`font-display text-ink min-w-0 break-words ${stack.name}`}
                style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
              >
                {ing.name}
              </span>
            </li>
          )
        })}
      </ul>

      {/* md and up: original inline, dot-separated form. */}
      <p className={`hidden md:block leading-snug ${inlineSizing}`}>
        {ingredients.map((ing, idx) => {
          const scaled = ing.amount * factor
          const hasAmount = scaled > 0
          return (
            <span key={ing.id} className="inline-block">
              {idx > 0 && (
                <span className="text-chestnut-soft mx-2" aria-hidden>·</span>
              )}
              {hasAmount && (
                <>
                  <span
                    className="num text-paprika tabular-nums"
                    style={{ fontFeatureSettings: '"tnum"' }}
                  >
                    {formatAmount(scaled)}
                  </span>
                  {ing.unit && (
                    <span className="font-mono uppercase tracking-[0.14em] text-chestnut text-[0.62em] ml-1">
                      {ing.unit}
                    </span>
                  )}
                  <span className="text-chestnut-soft mx-1.5" aria-hidden>—</span>
                </>
              )}
              <span
                className="font-display text-ink"
                style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
              >
                {ing.name}
              </span>
            </span>
          )
        })}
      </p>
    </div>
  )
}
