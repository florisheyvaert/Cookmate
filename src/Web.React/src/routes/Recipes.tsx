import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import { ApiError } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'

const ease = [0.22, 1, 0.36, 1] as const
const TIME_MAX = 180 // minutes — anything ≥ this is treated as "any time"
const TIME_STEP = 5

const btn =
  'inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 font-display font-semibold text-[0.9rem] leading-none no-underline transition-colors'
const btnGreen = `${btn} bg-paprika text-cream hover:bg-paprika-deep`

export default function Recipes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag') ?? null
  const sourceFromUrl = searchParams.get('source') ?? ''
  const maxTimeFromUrl = clampTime(Number(searchParams.get('maxTime')) || TIME_MAX)
  const [refineOpen, setRefineOpen] = useState(() => sourceFromUrl !== '' || maxTimeFromUrl < TIME_MAX)

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const search = useDeferredValue(searchInput.trim())

  const [sourceInput, setSourceInput] = useState(sourceFromUrl)
  const source = useDeferredValue(sourceInput.trim())
  const [maxTime, setMaxTime] = useState(maxTimeFromUrl)
  const maxTimeForApi = maxTime >= TIME_MAX ? undefined : maxTime

  const query = useQuery({
    queryKey: ['recipes', { search, tag: activeTag, source, maxTime: maxTimeForApi }],
    queryFn: () =>
      recipesApi.list({
        search: search || undefined,
        tag: activeTag ?? undefined,
        source: source || undefined,
        maxTimeMinutes: maxTimeForApi,
      }),
  })

  const visibleTags = useMemo<Array<{ tag: string; count: number }>>(() => {
    if (!query.data) return []
    const counts = new Map<string, number>()
    for (const r of query.data) {
      for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [query.data])

  const activeRefineCount = (source ? 1 : 0) + (maxTimeForApi ? 1 : 0)
  const totalActiveFilters = activeRefineCount + (activeTag ? 1 : 0) + (search ? 1 : 0)

  function setTag(next: string | null) {
    if (next) searchParams.set('tag', next)
    else searchParams.delete('tag')
    setSearchParams(searchParams, { replace: true })
  }
  function commitSearch(value: string) {
    if (value) searchParams.set('search', value)
    else searchParams.delete('search')
    setSearchParams(searchParams, { replace: true })
  }
  function commitSource(value: string) {
    if (value) searchParams.set('source', value)
    else searchParams.delete('source')
    setSearchParams(searchParams, { replace: true })
  }
  function commitMaxTime(value: number) {
    if (value < TIME_MAX) searchParams.set('maxTime', String(value))
    else searchParams.delete('maxTime')
    setSearchParams(searchParams, { replace: true })
  }
  function resetRefine() {
    setSourceInput('')
    setMaxTime(TIME_MAX)
    searchParams.delete('source')
    searchParams.delete('maxTime')
    setSearchParams(searchParams, { replace: true })
  }

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-16">
      <PageHeader
        eyebrow="Cookbook · Recipes"
        title="Recipes"
        subtitle="Everything on the shelf, alphabetical. Pick one to scale to today's table."
        action={
          <Link to="/recipes/new" className={btnGreen}>
            + New recipe
          </Link>
        }
      />

      {/* Search + refine toggle */}
      <div className="grid grid-cols-12 gap-4 items-end mb-6">
        <div className="col-span-12 md:col-span-7 lg:col-span-6">
          <span className="eyebrow block mb-2">Search</span>
          <div className="relative">
            <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 text-chestnut-soft text-base pointer-events-none">
              🔍
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={(e) => commitSearch(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitSearch(searchInput.trim())
              }}
              placeholder="title or summary…"
              className="w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 pl-7 font-display text-ink text-xl placeholder:text-chestnut-soft transition-colors"
            />
          </div>
        </div>
        <div className="col-span-12 md:col-span-5 lg:col-span-6 flex md:justify-end">
          <button
            type="button"
            onClick={() => setRefineOpen((v) => !v)}
            aria-expanded={refineOpen}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors font-mono text-[0.7rem] uppercase tracking-[0.16em]"
          >
            <span>Refine</span>
            {totalActiveFilters > 0 && <span className="num text-paprika">· {totalActiveFilters}</span>}
            <ChevronGlyph open={refineOpen} />
          </button>
        </div>
      </div>

      {/* Refine panel */}
      <AnimatePresence initial={false}>
        {refineOpen && (
          <motion.div
            key="refine"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-12 gap-x-6 gap-y-6 pt-2 pb-7 border-t border-cream-shadow">
              <label className="col-span-12 md:col-span-5 block">
                <span className="eyebrow block mb-2">Source</span>
                <input
                  type="text"
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  onBlur={(e) => commitSource(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitSource(sourceInput.trim())
                  }}
                  placeholder="dagelijksekost · ah · …"
                  className="w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 font-mono text-sm text-ink placeholder:text-chestnut-soft transition-colors"
                />
                <p className="font-mono text-[0.65rem] text-chestnut-soft mt-1.5">
                  Substring of the source URL. Recipes you typed in by hand pass too.
                </p>
              </label>

              <div className="col-span-12 md:col-span-7">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="eyebrow">Max time</span>
                  <span className="num text-paprika text-base">
                    {maxTime >= TIME_MAX ? 'any time' : `≤ ${formatDuration(maxTime)}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={TIME_MAX}
                  step={TIME_STEP}
                  value={maxTime}
                  onChange={(e) => setMaxTime(Number(e.target.value))}
                  onMouseUp={(e) => commitMaxTime(Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => commitMaxTime(Number((e.target as HTMLInputElement).value))}
                  onKeyUp={(e) => commitMaxTime(Number((e.target as HTMLInputElement).value))}
                  aria-label="Maximum total time in minutes"
                  className="slider-paprika"
                  style={{
                    background: `linear-gradient(to right, var(--color-paprika) 0%, var(--color-paprika) ${(maxTime / TIME_MAX) * 100}%, var(--color-cream-shadow) ${(maxTime / TIME_MAX) * 100}%, var(--color-cream-shadow) 100%)`,
                  }}
                />
                <div className="flex justify-between font-mono text-[0.65rem] uppercase tracking-[0.18em] text-chestnut-soft mt-2">
                  <span>0 min</span>
                  <span>1 u</span>
                  <span>2 u</span>
                  <span>3 u</span>
                </div>
              </div>

              {activeRefineCount > 0 && (
                <div className="col-span-12 flex justify-end">
                  <button
                    type="button"
                    onClick={resetRefine}
                    className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors"
                  >
                    ↺ Reset refine
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="mt-6">
          <span className="eyebrow block mb-2.5">Tags</span>
          <div className="flex flex-wrap gap-2">
            <TagChip label="All" count={query.data?.length ?? 0} active={activeTag === null} onClick={() => setTag(null)} />
            {visibleTags.map(({ tag, count }) => (
              <TagChip
                key={tag}
                label={tag}
                count={count}
                active={activeTag === tag}
                onClick={() => setTag(activeTag === tag ? null : tag)}
              />
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-8">
        {query.isPending && <ListSkeleton />}
        {query.isError && <ListError error={query.error} />}
        {query.isSuccess && query.data.length === 0 && <EmptyShelf hasFilters={totalActiveFilters > 0} />}
        {query.isSuccess && query.data.length > 0 && (
          <ol className="border-t border-cream-shadow">
            {query.data.map((recipe, i) => (
              <motion.li
                key={recipe.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.45, ease }}
                className="border-b border-cream-shadow"
              >
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="group grid grid-cols-[4.5rem_1fr_auto] md:grid-cols-[5.5rem_1fr_auto] gap-4 md:gap-5 py-4 md:py-5 items-center no-underline"
                >
                  <Thumb url={recipe.coverImageUrl} ordinal={i + 1} />

                  <div className="min-w-0">
                    <h2
                      className="font-display text-ink text-xl md:text-2xl group-hover:text-paprika transition-colors truncate"
                      style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
                    >
                      {recipe.title}
                    </h2>
                    {recipe.tags.length > 0 && (
                      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-chestnut-soft mt-1 truncate">
                        {recipe.tags.slice(0, 4).join(' · ')}
                      </p>
                    )}
                    {recipe.summary && (
                      <p className="hidden md:block text-chestnut text-sm leading-snug truncate mt-1">{recipe.summary}</p>
                    )}
                  </div>

                  <span className="text-right flex flex-col items-end gap-0.5 shrink-0">
                    <span className="whitespace-nowrap">
                      <span className="num text-paprika text-base">{recipe.baseServings}</span>
                      <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut ml-1.5">serves</span>
                    </span>
                    {formatDuration(recipe.totalTimeMinutes) && (
                      <span className="num text-chestnut text-xs whitespace-nowrap">
                        {formatDuration(recipe.totalTimeMinutes)}
                      </span>
                    )}
                  </span>
                </Link>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function clampTime(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return TIME_MAX
  if (n > TIME_MAX) return TIME_MAX
  return n
}

/** Square thumbnail for a recipe row — same dimensions always, so no layout shift. */
function Thumb({ url, ordinal }: { url: string | null; ordinal: number }) {
  return (
    <div className="relative w-[4.5rem] h-[4.5rem] md:w-[5.5rem] md:h-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-cream-deep border border-cream-shadow">
      {url ? (
        <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(120% 80% at 20% 20%, rgba(47,125,79,0.14), transparent 60%),' +
              'linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream-shadow) 100%)',
          }}
        >
          <span aria-hidden className="text-2xl leading-none select-none opacity-70">
            🍽️
          </span>
        </div>
      )}
      <span
        className="absolute top-0 left-0 px-1.5 py-0.5 bg-cream/85 text-chestnut font-mono text-[0.6rem] tabular-nums rounded-br-md"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {String(ordinal).padStart(2, '0')}
      </span>
    </div>
  )
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

type TagChipProps = {
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function TagChip({ label, count, active, onClick }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-full font-mono text-[0.68rem] uppercase tracking-[0.14em] border transition-colors',
        active
          ? 'bg-paprika text-cream border-paprika'
          : 'border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className={['num text-[0.62rem]', active ? 'text-cream/70' : 'text-chestnut-soft'].join(' ')}>{count}</span>
    </button>
  )
}

function ListSkeleton() {
  return (
    <ol className="border-t border-cream-shadow">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="border-b border-cream-shadow py-5 flex items-center gap-5">
          <span className="w-[4.5rem] h-[4.5rem] md:w-[5.5rem] md:h-[5.5rem] bg-cream-shadow/50 rounded-lg shrink-0 animate-pulse" />
          <span className="flex-1 space-y-2">
            <span className="block h-6 bg-cream-shadow/50 rounded w-2/3" />
            <span className="block h-3 bg-cream-shadow/40 rounded w-1/3" />
          </span>
          <span className="h-4 w-16 bg-cream-shadow/40 rounded" />
        </li>
      ))}
    </ol>
  )
}

function ListError({ error }: { error: unknown }) {
  const status = error instanceof ApiError ? error.status : null
  return (
    <div className="border border-paprika/30 bg-paprika-tint rounded-2xl p-8">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-paprika mb-2">
        Could not load recipes {status ? `· ${status}` : ''}
      </p>
      <p className="text-ink-soft">
        Check that the API is running. The Aspire dashboard should show{' '}
        <code className="font-mono text-paprika">webapi</code> in the green.
      </p>
    </div>
  )
}

function EmptyShelf({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="border border-dashed border-cream-shadow rounded-2xl p-10 md:p-14 text-center">
      <p className="eyebrow mb-3">{hasFilters ? 'Nothing matches' : 'Empty shelf'}</p>
      <p className="text-ink-soft text-lg max-w-md mx-auto mb-7">
        {hasFilters
          ? 'No recipes match those filters. Loosen the search, swap the tag, or open Refine and reset.'
          : 'No recipes yet. Save your first one and it will appear here, alphabetised, ready to scale.'}
      </p>
      {!hasFilters && (
        <Link to="/recipes/new" className={`${btnGreen} mx-auto`}>
          + New recipe
        </Link>
      )}
    </div>
  )
}
