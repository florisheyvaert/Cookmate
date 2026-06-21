import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { suggestionsApi, type SuggestionIngredient } from '@/api/suggestions'
import { ApiError } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { PlanSuggestionDialog } from '@/components/PlanSuggestionDialog'

const ease = [0.22, 1, 0.36, 1] as const

function ingredientLine(i: SuggestionIngredient): string {
  const qty = [i.amount > 0 ? trimNumber(i.amount) : '', i.unit ?? ''].filter(Boolean).join(' ')
  const head = [qty, i.name].filter(Boolean).join(' ')
  return i.notes ? `${head} (${i.notes})` : head
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '')
}

export default function MealSuggestionDetail() {
  const { id } = useParams()
  const suggestionId = Number(id)
  const [planOpen, setPlanOpen] = useState(false)

  const query = useQuery({
    queryKey: ['meal-suggestion', suggestionId],
    queryFn: () => suggestionsApi.get(suggestionId),
    enabled: Number.isFinite(suggestionId),
  })

  if (query.isPending) {
    return (
      <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-16">
        <p className="eyebrow">Plating up…</p>
      </div>
    )
  }

  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : null
    return (
      <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-16">
        <p className="eyebrow text-paprika mb-3">Not found {status ? `· ${status}` : ''}</p>
        <Link to="/suggestions" className="text-ink-soft underline">
          ← Back to ideas
        </Link>
      </div>
    )
  }

  const s = query.data

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-16">
      <PageHeader
        eyebrow={`Idea · ${s.sourceName ?? 'Suggestion'}`}
        title={s.title}
        action={
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 bg-paprika text-cream hover:bg-paprika-deep transition-colors font-display font-semibold text-[0.9rem]"
          >
            + Add to meal plan
          </button>
        }
      />

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[0.7rem] text-chestnut mb-7">
        <span>
          <span className="num text-paprika text-sm">{s.baseServings}</span> serves
        </span>
        {formatDuration(s.totalTimeMinutes) && <span className="num">{formatDuration(s.totalTimeMinutes)}</span>}
        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-chestnut hover:text-paprika transition-colors underline">
          View original ↗
        </a>
      </div>

      {s.imageUrl && (
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease }}
          src={s.imageUrl}
          alt=""
          className="w-full max-h-[26rem] object-cover rounded-2xl border border-cream-shadow mb-8"
        />
      )}

      {s.summary && <p className="text-ink-soft text-lg leading-relaxed max-w-2xl mb-8">{s.summary}</p>}

      {s.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {s.tags.map((t) => (
            <span key={t} className="font-mono text-[0.62rem] uppercase tracking-[0.14em] px-3 py-1.5 rounded-full border border-cream-shadow text-chestnut">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-10 lg:gap-16">
        {/* Ingredients */}
        <section>
          <h2 className="eyebrow mb-4">Ingredients</h2>
          {s.ingredients.length > 0 ? (
            <ul className="space-y-2.5">
              {s.ingredients.map((ing, i) => (
                <li key={i} className="text-ink leading-snug border-b border-cream-shadow pb-2.5">
                  {ingredientLine(ing)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-chestnut-soft">No ingredients were captured — open the original.</p>
          )}
        </section>

        {/* Steps */}
        <section>
          <h2 className="eyebrow mb-4">Method</h2>
          {s.steps.length > 0 ? (
            <ol className="space-y-5">
              {s.steps.map((step, i) => (
                <li key={i} className="grid grid-cols-[2rem_1fr] gap-4">
                  <span className="num text-paprika text-lg">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-ink leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-chestnut-soft">No steps were captured — open the original.</p>
          )}
        </section>
      </div>

      <PlanSuggestionDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title={s.title}
        sourceUrl={s.sourceUrl}
        suggestionId={s.id}
        baseServings={s.baseServings}
      />
    </div>
  )
}
