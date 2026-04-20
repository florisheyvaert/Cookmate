import type { RecipeIngredientDto } from '@/api/types'
import { formatAmount } from '@/lib/format'

/**
 * The "mise" caption that sits above a step body — annotated margin in the
 * cookbook tradition. Renders detected ingredients as `AMOUNT UNIT — name`,
 * dot-separated, with a thin paprika rule on the leading edge.
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

  const sizing =
    size === 'lg' ? 'text-lg md:text-xl' : size === 'md' ? 'text-base md:text-lg' : 'text-sm'

  return (
    <p className={`mb-3 leading-snug border-l-2 border-paprika/60 pl-3 ${sizing}`}>
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
  )
}
