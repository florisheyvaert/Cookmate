import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import { ApiError } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { findStepIngredients } from '@/lib/stepIngredients'
import { MiseLine } from '@/components/MiseLine'

const ease = [0.22, 1, 0.36, 1] as const

type WakeLockSentinel = { released: boolean; release: () => Promise<void> }

export default function CookMode() {
  const { id: idParam } = useParams<{ id: string }>()
  const id = Number(idParam)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedServings = Number(searchParams.get('servings')) || undefined
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)

  // Fetch once; ingredient amounts are scaled client-side from baseServings.
  const query = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const recipe = query.data
  const totalSteps = recipe?.steps.length ?? 0
  const targetServings = requestedServings ?? recipe?.baseServings ?? 0
  const factor = recipe ? targetServings / recipe.baseServings : 1

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1))
  }
  function goNext() {
    setStepIndex((i) => Math.min(totalSteps - 1, i + 1))
  }
  function setServings(next: number) {
    if (next < 1 || !recipe) return
    if (next === recipe.baseServings) {
      searchParams.delete('servings')
    } else {
      searchParams.set('servings', String(next))
    }
    setSearchParams(searchParams, { replace: true })
  }
  function exit() {
    const qs = requestedServings ? `?servings=${requestedServings}` : ''
    navigate(`/recipes/${id}${qs}`)
  }

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Escape') {
        // If the ingredients panel is open, close it first; otherwise exit cook mode.
        if (showIngredients) setShowIngredients(false)
        else exit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSteps, requestedServings, showIngredients])

  // Wake lock — best-effort, browser-supported.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let released = false

    async function acquire() {
      const wl = (navigator as Navigator & { wakeLock?: { request: (kind: 'screen') => Promise<WakeLockSentinel> } }).wakeLock
      if (!wl) return
      try {
        sentinel = await wl.request('screen')
      } catch {
        // Permission/visibility issue — silently ignore.
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible' && !released) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [])

  if (query.isPending) {
    return <FullScreen><p className="eyebrow">Heating up…</p></FullScreen>
  }
  if (query.isError) {
    return <FullScreen><ErrorView error={query.error} onExit={exit} /></FullScreen>
  }
  if (!recipe || totalSteps === 0) {
    return (
      <FullScreen>
        <p className="eyebrow text-paprika mb-2">Nothing to cook</p>
        <p className="text-ink-soft text-lg max-w-md">This recipe has no steps yet. Add some, then come back.</p>
        <button
          onClick={exit}
          className="mt-6 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline"
        >
          ← Back to recipe
        </button>
      </FullScreen>
    )
  }

  const currentStep = recipe.steps[stepIndex]
  const stepIngredients = findStepIngredients(currentStep.instruction, recipe.ingredients)
  const progress = ((stepIndex + 1) / totalSteps) * 100

  return (
    <div className="fixed inset-0 z-50 bg-cream flex flex-col overflow-hidden">
      <header className="px-6 md:px-12 lg:px-20 pt-6 pb-3 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-4 flex-wrap min-w-0">
          <p className="eyebrow">Cook mode</p>
          <p
            className="font-display text-ink text-xl md:text-2xl truncate max-w-[40vw]"
            style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1' }}
          >
            {recipe.title}
          </p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <ServingsCompact base={recipe.baseServings} current={targetServings} onChange={setServings} />
          <button
            type="button"
            onClick={() => setShowIngredients((v) => !v)}
            aria-pressed={showIngredients}
            className={[
              'inline-flex items-center gap-2 font-mono uppercase tracking-[0.2em] text-[0.7rem] md:text-[0.72rem] transition-colors',
              showIngredients ? 'text-paprika' : 'text-chestnut hover:text-paprika',
            ].join(' ')}
          >
            <ListGlyph />
            <span className="hidden sm:inline">All ingredients</span>
          </button>
          <button
            type="button"
            onClick={exit}
            aria-label="Exit cook mode"
            className="w-8 h-8 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors"
          >
            ×
          </button>
        </div>
      </header>

      <div className="h-px bg-cream-shadow w-full">
        <div
          className="h-px bg-paprika transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage area: step content + (optional) ingredients side panel.
          On mobile the panel is a fullscreen overlay; on md+ it docks on the right. */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <main className="flex-1 flex flex-col items-stretch justify-center px-6 md:px-12 lg:px-24 py-10 overflow-y-auto">
          <p className="eyebrow mb-6 text-center">
            Step <span className="num text-paprika">{stepIndex + 1}</span>{' '}
            <span className="text-chestnut-soft">/</span>{' '}
            <span className="num">{totalSteps}</span>
          </p>

          <div className="mx-auto max-w-4xl w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease }}
              >
                {stepIngredients.length > 0 && (
                  <div className="mb-6 md:mb-10">
                    <MiseLine ingredients={stepIngredients} factor={factor} size="lg" />
                  </div>
                )}
                <p
                  className="font-display text-ink text-center"
                  style={{
                    fontSize: 'clamp(1.6rem, 3.2vw, 2.6rem)',
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                    fontVariationSettings: '"opsz" 72, "SOFT" 50, "WONK" 0',
                  }}
                >
                  {currentStep.instruction}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <AnimatePresence>
          {showIngredients && (
            <motion.aside
              key="panel"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.28, ease }}
              className="
                fixed inset-0 z-40 bg-cream
                md:static md:inset-auto md:z-auto md:flex-none
                md:w-[24rem] lg:w-[28rem]
                md:border-l md:border-cream-shadow
                overflow-y-auto
              "
            >
              <div className="px-6 md:px-8 pt-6 md:pt-8 pb-3 flex items-baseline justify-between gap-4 md:sticky md:top-0 bg-cream md:bg-transparent">
                <p className="eyebrow">All ingredients</p>
                <button
                  type="button"
                  onClick={() => setShowIngredients(false)}
                  aria-label="Close ingredients"
                  className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
                >
                  Close ×
                </button>
              </div>
              <ul className="px-6 md:px-8 pb-10 space-y-3">
                {[...recipe.ingredients]
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                  .map((ing) => {
                    const scaled = ing.amount * factor
                    const hasAmount = scaled > 0
                    return (
                      <li
                        key={ing.id}
                        className="grid grid-cols-[4.5rem_2.5rem_1fr] items-baseline gap-x-3 border-b border-cream-shadow pb-2"
                      >
                        <span
                          className="num text-paprika text-base text-right tabular-nums"
                          style={{ fontFeatureSettings: '"tnum"' }}
                        >
                          {hasAmount ? formatAmount(scaled) : ''}
                        </span>
                        <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut-soft">
                          {hasAmount ? ing.unit || '' : ''}
                        </span>
                        <span
                          className="font-display text-ink leading-snug"
                          style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                        >
                          {ing.name}
                          {ing.notes && (
                            <span className="text-chestnut text-sm italic ml-2">— {ing.notes}</span>
                          )}
                        </span>
                      </li>
                    )
                  })}
              </ul>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <footer className="px-6 md:px-12 lg:px-20 py-6 flex items-center justify-between gap-4 border-t border-cream-shadow">
        <NavButton onClick={goPrev} disabled={stepIndex === 0} label="Previous step">
          ← Previous
        </NavButton>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-chestnut-soft hidden sm:block">
          ← / → · Esc {showIngredients ? 'closes panel' : 'exits'}
        </p>
        <NavButton
          onClick={goNext}
          disabled={stepIndex >= totalSteps - 1}
          label="Next step"
          primary
        >
          {stepIndex >= totalSteps - 1 ? 'Done' : 'Next →'}
        </NavButton>
      </footer>
    </div>
  )
}

function ListGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <path d="M2 3h10" />
      <path d="M2 7h10" />
      <path d="M2 11h7" />
    </svg>
  )
}

function NavButton({
  onClick,
  disabled,
  label,
  primary,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  primary?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        'inline-flex items-center gap-2 px-6 py-3 font-mono uppercase tracking-[0.18em] text-[0.78rem] transition-colors',
        primary
          ? 'bg-ink text-cream hover:bg-paprika'
          : 'border border-chestnut/40 text-chestnut hover:border-paprika hover:text-paprika',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-ink disabled:hover:text-cream',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ServingsCompact({
  base,
  current,
  onChange,
}: {
  base: number
  current: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
        aria-label="Fewer servings"
        className="w-6 h-6 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors text-xs disabled:opacity-30 disabled:cursor-not-allowed"
      >
        −
      </button>
      <span className="num text-paprika text-base min-w-[1.5rem] text-center" title={`Base ${base}`}>
        {current}
      </span>
      <button
        type="button"
        onClick={() => onChange(current + 1)}
        aria-label="More servings"
        className="w-6 h-6 flex items-center justify-center font-mono text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors text-xs"
      >
        +
      </button>
    </div>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-cream flex flex-col items-center justify-center px-6">
      {children}
    </div>
  )
}

function ErrorView({ error, onExit }: { error: unknown; onExit: () => void }) {
  const status = error instanceof ApiError ? error.status : null
  return (
    <>
      <p className="eyebrow text-paprika mb-2">
        Could not load this recipe {status ? `· ${status}` : ''}
      </p>
      <button
        onClick={onExit}
        className="mt-6 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline"
      >
        ← Back
      </button>
    </>
  )
}
