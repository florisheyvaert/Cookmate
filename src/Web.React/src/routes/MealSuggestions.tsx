import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { suggestionsApi, SUGGESTIONS_PAGE_SIZE, type MealSuggestionDto, type SuggestionSort } from '@/api/suggestions'
import { ApiError } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { PageHeader } from '@/components/PageHeader'
import { Listbox, type ListboxOption } from '@/components/Listbox'
import { PlanSuggestionDialog } from '@/components/PlanSuggestionDialog'

const ease = [0.22, 1, 0.36, 1] as const
const TAG_LIMIT = 12 // tags shown before the "+N more" toggle

const SORT_OPTIONS: ListboxOption[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
]

// Card grid: one big full-width card on mobile, more per row as space grows.
const CARD_GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'

// Friendly "Planned this Monday" / "Planned · Mon 23 Jun" label for a yyyy-MM-dd date.
function plannedLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekStart = (x: Date) => {
    const r = new Date(x.getFullYear(), x.getMonth(), x.getDate())
    r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
    return r.getTime()
  }
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)
  if (weekStart(date) === weekStart(new Date())) return `Planned this ${weekday}`
  return `Planned · ${new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(date)}`
}

export default function MealSuggestions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTag = searchParams.get('tag') ?? null
  const sourceId = searchParams.get('sourceId') ? Number(searchParams.get('sourceId')) : null
  const sortParam = searchParams.get('sort')
  const sort: SuggestionSort = sortParam === 'oldest' || sortParam === 'title' ? sortParam : 'newest'
  const view: 'week' | 'all' = searchParams.get('view') === 'all' ? 'all' : 'week'

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const search = useDeferredValue(searchInput.trim())

  const sourcesQ = useQuery({ queryKey: ['suggestion-sources'], queryFn: () => suggestionsApi.sources.list() })

  // "This week": the catalog-style weekly offering of ~50 main courses, reshuffled weekly.
  const weeklyQ = useQuery({
    queryKey: ['weekly-ideas'],
    queryFn: () => suggestionsApi.weeklyIdeas(),
    enabled: view === 'week',
  })

  const query = useInfiniteQuery({
    queryKey: ['meal-suggestions', { search, tag: activeTag, sourceId, sort }],
    queryFn: ({ pageParam }) =>
      suggestionsApi.browse({
        search: search || undefined,
        tag: activeTag ?? undefined,
        sourceId: sourceId ?? undefined,
        sort,
        page: pageParam,
        pageSize: SUGGESTIONS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    // A full page means there may be more; a short page is the end.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === SUGGESTIONS_PAGE_SIZE ? allPages.length + 1 : undefined,
  })

  const items = useMemo(() => query.data?.pages.flat() ?? [], [query.data])

  // Tag counts come from a facets query over the WHOLE filtered set (not just the
  // loaded pages and not narrowed by the selected tag), so they're complete at once.
  const facetsQ = useQuery({
    queryKey: ['meal-suggestion-facets', { search, sourceId }],
    queryFn: () =>
      suggestionsApi.facets({
        search: search || undefined,
        sourceId: sourceId ?? undefined,
      }),
  })
  const visibleTags = facetsQ.data?.tags ?? []
  const totalCount = facetsQ.data?.total ?? 0
  const [showAllTags, setShowAllTags] = useState(false)
  const shownTags = showAllTags ? visibleTags : visibleTags.slice(0, TAG_LIMIT)

  // Scroll-to-load: fetch the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

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
  function setSource(next: string) {
    if (next) searchParams.set('sourceId', next)
    else searchParams.delete('sourceId')
    setSearchParams(searchParams, { replace: true })
  }
  function setSort(next: string) {
    if (next && next !== 'newest') searchParams.set('sort', next)
    else searchParams.delete('sort')
    setSearchParams(searchParams, { replace: true })
  }
  function setView(next: 'week' | 'all') {
    if (next === 'all') searchParams.set('view', 'all')
    else searchParams.delete('view')
    setSearchParams(searchParams, { replace: true })
  }

  const sourceOptions: ListboxOption[] = [
    { value: '', label: 'All sources' },
    ...(sourcesQ.data?.map((s) => ({ value: String(s.id), label: s.name })) ?? []),
  ]

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-16">
      <PageHeader
        eyebrow="Discover · Suggestions"
        title="Meal ideas"
        subtitle="Your scraped catalog of dishes. This week's main-course picks are below — or browse everything."
        action={
          <Link
            to="/settings?section=integrations"
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors font-mono text-[0.7rem] uppercase tracking-[0.16em] no-underline"
          >
            ⚙ Manage sources
          </Link>
        }
      />

      {/* View toggle */}
      <div className="inline-flex rounded-xl border border-cream-shadow p-1 mb-8">
        <ViewTab active={view === 'week'} onClick={() => setView('week')}>
          This week
        </ViewTab>
        <ViewTab active={view === 'all'} onClick={() => setView('all')}>
          All ideas
        </ViewTab>
      </div>

      {/* ── This week: ~50 main courses, reshuffled weekly ───────────────────── */}
      {view === 'week' && (
        <div>
          <p className="text-ink-soft max-w-2xl mb-7">
            This week's main courses, freshly shuffled. {weeklyQ.data && weeklyQ.data.length > 0 ? `${weeklyQ.data.length} to look through` : ''} — open any to see the full recipe, or add it straight to your plan.
          </p>
          {weeklyQ.isPending && <ListSkeleton />}
          {weeklyQ.isError && <ListError error={weeklyQ.error} />}
          {weeklyQ.isSuccess && weeklyQ.data.length === 0 && <NoMainCourses />}
          {weeklyQ.isSuccess && weeklyQ.data.length > 0 && (
            <div className={CARD_GRID}>
              {weeklyQ.data.map((s, i) => (
                <SuggestionCard key={s.id} suggestion={s} index={Math.min(i, 12)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── All ideas: full catalog, searchable/filterable, infinite scroll ───── */}
      {view === 'all' && (
        <>
          <div className="grid grid-cols-12 gap-4 items-end mb-6">
            <div className="col-span-12 md:col-span-6">
              <span className="eyebrow block mb-2">Search</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onBlur={(e) => commitSearch(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSearch(searchInput.trim())
                }}
                placeholder="title or summary…"
                className="w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 font-display text-ink text-xl placeholder:text-chestnut-soft transition-colors"
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <span className="eyebrow block mb-2">Source</span>
              <Listbox
                ariaLabel="Filter by source"
                value={sourceId != null ? String(sourceId) : ''}
                onChange={setSource}
                options={sourceOptions}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <span className="eyebrow block mb-2">Sort</span>
              <Listbox ariaLabel="Sort suggestions" value={sort} onChange={setSort} options={SORT_OPTIONS} />
            </div>
          </div>

          {/* Tags — compact, single block; collapses long lists behind "+N more". */}
          {visibleTags.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              <TagChip label="All" count={totalCount} active={activeTag === null} onClick={() => setTag(null)} />
              {shownTags.map(({ tag, count }) => (
                <TagChip
                  key={tag}
                  label={tag}
                  count={count}
                  active={activeTag === tag}
                  onClick={() => setTag(activeTag === tag ? null : tag)}
                />
              ))}
              {visibleTags.length > TAG_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllTags((v) => !v)}
                  className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-paprika hover:text-paprika-deep transition-colors px-1.5 py-1"
                >
                  {showAllTags ? '− less' : `+${visibleTags.length - TAG_LIMIT} more`}
                </button>
              )}
            </div>
          )}

          <div className="mt-8">
            {query.isPending && <ListSkeleton />}
            {query.isError && <ListError error={query.error} />}
            {query.isSuccess && items.length === 0 && <EmptyPool hasFilters={!!(search || activeTag || sourceId)} />}
            {query.isSuccess && items.length > 0 && (
              <>
                <div className={CARD_GRID}>
                  {items.map((suggestion, i) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} index={Math.min(i, SUGGESTIONS_PAGE_SIZE)} />
                  ))}
                </div>

                <div ref={sentinelRef} className="h-10" />
                <p className="text-center font-mono text-[0.66rem] uppercase tracking-[0.16em] text-chestnut-soft py-4">
                  {query.isFetchingNextPage
                    ? 'Loading more…'
                    : query.hasNextPage
                      ? 'Scroll for more'
                      : `${items.length} idea${items.length === 1 ? '' : 's'} · that's everything`}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-4 py-2 font-mono text-[0.66rem] uppercase tracking-[0.16em] transition-colors',
        active ? 'bg-paprika text-cream' : 'text-chestnut hover:text-paprika',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function NoMainCourses() {
  return (
    <div className="border border-dashed border-cream-shadow rounded-2xl p-10 md:p-14 text-center">
      <p className="eyebrow mb-3">No main courses yet</p>
      <p className="text-ink-soft text-lg max-w-md mx-auto">
        Harvest some sources first — this week's picks are drawn from scraped main courses (tagged
        “hoofdgerecht”). You can still browse everything under <strong>All ideas</strong>.
      </p>
    </div>
  )
}

function SuggestionCard({ suggestion, index }: { suggestion: MealSuggestionDto; index: number }) {
  const [planOpen, setPlanOpen] = useState(false)
  const [plannedDate, setPlannedDate] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Auto-dismiss the "Planned this Monday" toast after a moment; the subtle
  // corner badge stays.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  function handlePlanned(iso: string) {
    setPlannedDate(iso)
    setToast(plannedLabel(iso))
  }

  const time = formatDuration(suggestion.totalTimeMinutes)
  const to = `/suggestions/${suggestion.id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.4, ease }}
      className="group flex flex-col rounded-2xl border border-cream-shadow bg-cream-deep overflow-hidden hover:border-paprika/50 transition-colors"
    >
      <Link to={to} className="relative block no-underline">
        <CardImage url={suggestion.imageUrl} />
        {time && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-cream/90 px-2.5 py-1 font-mono text-[0.68rem] text-ink shadow-sm backdrop-blur-sm">
            <span aria-hidden>🕒</span>
            <span className="num">{time}</span>
          </span>
        )}

        {/* Persistent, subtle "planned" badge */}
        {plannedDate && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-paprika text-cream px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] shadow-sm pointer-events-none">
            ✓ Planned
          </span>
        )}

        {/* Transient confirmation that fades out */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key="toast"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 flex items-center justify-center bg-paprika/85 text-cream pointer-events-none px-4 text-center"
            >
              <span className="font-display font-semibold text-base leading-tight">
                <span aria-hidden>✓ </span>
                {toast}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link
          to={to}
          className="font-display text-ink text-lg md:text-xl leading-tight hover:text-paprika transition-colors no-underline line-clamp-2"
          style={{ fontWeight: 700, letterSpacing: '-0.01em' }}
        >
          {suggestion.title}
        </Link>
        {suggestion.tags.length > 0 && (
          <p className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-chestnut-soft mt-1.5 truncate">
            {suggestion.tags.slice(0, 3).join(' · ')}
          </p>
        )}

        <div className="mt-auto pt-3.5">
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className={[
              'w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition-colors font-mono text-[0.64rem] uppercase tracking-[0.14em]',
              plannedDate
                ? 'bg-paprika text-cream hover:bg-paprika-deep'
                : 'bg-paprika-tint text-paprika-deep hover:bg-paprika hover:text-cream',
            ].join(' ')}
          >
            {plannedDate ? '✓ Planned · add another' : '🗓 Add to plan'}
          </button>
        </div>
      </div>

      <PlanSuggestionDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onPlanned={handlePlanned}
        title={suggestion.title}
        sourceUrl={suggestion.sourceUrl}
        suggestionId={suggestion.id}
        baseServings={suggestion.baseServings}
        imageUrl={suggestion.imageUrl}
      />
    </motion.div>
  )
}

function CardImage({ url }: { url: string | null }) {
  return (
    <div className="aspect-[4/3] w-full overflow-hidden bg-cream-shadow/40">
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(120% 80% at 20% 20%, rgba(47,125,79,0.14), transparent 60%),' +
              'linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream-shadow) 100%)',
          }}
        >
          <span aria-hidden className="text-4xl leading-none select-none opacity-60">
            🍽️
          </span>
        </div>
      )}
    </div>
  )
}

type TagChipProps = { label: string; count: number; active: boolean; onClick: () => void }

function TagChip({ label, count, active, onClick }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-baseline gap-1 px-2.5 py-1 rounded-full font-mono text-[0.62rem] uppercase tracking-[0.12em] border transition-colors',
        active ? 'bg-paprika text-cream border-paprika' : 'border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className={['num text-[0.56rem]', active ? 'text-cream/70' : 'text-chestnut-soft'].join(' ')}>{count}</span>
    </button>
  )
}

function ListSkeleton() {
  return (
    <div className={CARD_GRID}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-cream-shadow overflow-hidden">
          <div className="aspect-[4/3] bg-cream-shadow/50 animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-2.5 bg-cream-shadow/40 rounded w-1/3" />
            <div className="h-5 bg-cream-shadow/50 rounded w-3/4" />
            <div className="h-8 bg-cream-shadow/30 rounded mt-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ListError({ error }: { error: unknown }) {
  const status = error instanceof ApiError ? error.status : null
  return (
    <div className="border border-paprika/30 bg-paprika-tint rounded-2xl p-8">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-paprika mb-2">
        Could not load suggestions {status ? `· ${status}` : ''}
      </p>
      <p className="text-ink-soft">Check that the API is running.</p>
    </div>
  )
}

function EmptyPool({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="border border-dashed border-cream-shadow rounded-2xl p-10 md:p-14 text-center">
      <p className="eyebrow mb-3">{hasFilters ? 'Nothing matches' : 'Empty pool'}</p>
      <p className="text-ink-soft text-lg max-w-md mx-auto mb-7">
        {hasFilters
          ? 'No suggestions match those filters. Loosen the search or pick another source.'
          : 'No suggestions yet. Add a source and run a harvest to fill the pool.'}
      </p>
      {!hasFilters && (
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 bg-paprika text-cream hover:bg-paprika-deep transition-colors font-display font-semibold text-[0.9rem] no-underline mx-auto"
        >
          ⚙ Manage sources
        </Link>
      )}
    </div>
  )
}
