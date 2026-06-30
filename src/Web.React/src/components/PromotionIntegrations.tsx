import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { promotionsApi, type PromotionIntegration } from '@/api/promotions'
import {
  suggestionsApi,
  type HarvestReport,
  type HarvestSchedule,
  HARVEST_STATUS_LABELS,
  HARVEST_STATUS_PROCESSING,
  HARVEST_TRIGGER_LABELS,
} from '@/api/suggestions'
import { Listbox, type ListboxOption } from '@/components/Listbox'

const ease = [0.22, 1, 0.36, 1] as const
const INTEGRATIONS_KEY = ['promotion-integrations']
const RUNS_KEY = ['promotion-runs']

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_OPTIONS: ListboxOption[] = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: DAY_LABELS[d] }))

// Brand → recipe-source host labels, so a store that is *also* a recipe source shows both
// capabilities on one card. Matching is by the host's first label (ah.be → "ah").
const RECIPE_HOST_HINTS: Record<string, string[]> = {
  ah: ['ah'],
}

// 0 Succeeded · 1 Partial · 2 Failed · 3 Processing — shared with the harvest history.
function statusPill(status: number): string {
  if (status === HARVEST_STATUS_PROCESSING)
    return 'bg-cream-shadow/60 text-ink-soft ring-1 ring-inset ring-cream-shadow animate-pulse'
  if (status === 0) return 'bg-paprika/15 text-paprika-deep ring-1 ring-inset ring-paprika/30'
  if (status === 1) return 'bg-butter/25 text-[#7a5a12] ring-1 ring-inset ring-butter/50'
  return 'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-500/30'
}

function relativeDay(iso: string): string {
  const then = new Date(iso)
  const days = Math.round((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString()
}

/**
 * The "Stores" group of the Integrations section: which stores Cookmate pulls promotions
 * from. Each store is a card whose "capability rows" read like a label: an editable
 * Promotions row, plus a read-only Recipes row when the same brand is also a recipe source
 * — so it's obvious that Albert Heijn does both while another store might only do promos.
 */
export function PromotionIntegrations() {
  const integrationsQ = useQuery({
    queryKey: INTEGRATIONS_KEY,
    queryFn: () => promotionsApi.integrations.list(),
    // Keep the card live while a refresh is running server-side.
    refetchInterval: (q) =>
      q.state.data?.some((s) => s.lastRunStatus === HARVEST_STATUS_PROCESSING) ? 2500 : false,
  })
  // Used only to detect which stores are also recipe sources (for the second row).
  const sourcesQ = useQuery({ queryKey: ['suggestion-sources'], queryFn: () => suggestionsApi.sources.list() })

  const stores = integrationsQ.data ?? []
  const recipeHosts = (sourcesQ.data ?? []).map((s) => s.host.toLowerCase())

  function recipeSourceFor(storeCode: string): boolean {
    const hints = RECIPE_HOST_HINTS[storeCode] ?? [storeCode]
    return recipeHosts.some((host) => hints.some((h) => host.split('.')[0] === h || host.includes(`${h}.`)))
  }

  return (
    <div>
      <div className="flex items-baseline gap-2.5 mb-1.5">
        <span className="eyebrow text-paprika">Stores · promotions</span>
        <span aria-hidden>🏷️</span>
      </div>
      <p className="text-ink-soft text-sm leading-relaxed mb-4">
        Switch a store on to cache its weekly bonus, and set when the refresh runs on its own.
      </p>

      <SchedulePanel />

      {integrationsQ.isPending ? (
        <p className="font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>
      ) : stores.length === 0 ? (
        <p className="text-ink-soft leading-relaxed">
          No stores support promotions yet. They'll appear here as they're added.
        </p>
      ) : (
        <div className="space-y-4">
          {stores.map((store, i) => (
            <ProviderCard key={store.storeCode} store={store} index={i} hasRecipes={recipeSourceFor(store.storeCode)} />
          ))}
        </div>
      )}

      <RunHistory />
    </div>
  )
}

function ProviderCard({ store, index, hasRecipes }: { store: PromotionIntegration; index: number; hasRecipes: boolean }) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: INTEGRATIONS_KEY })
    queryClient.invalidateQueries({ queryKey: RUNS_KEY })
  }
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => promotionsApi.integrations.setEnabled(store.storeCode, enabled),
    onSuccess: invalidate,
  })
  const refresh = useMutation({
    mutationFn: () => promotionsApi.refresh(store.storeCode),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['promotions', store.storeCode] })
    },
  })

  const processing = store.lastRunStatus === HARVEST_STATUS_PROCESSING
  const busy = refresh.isPending || processing

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.35, ease }}
      className="rounded-2xl border border-cream-shadow bg-cream-deep overflow-hidden"
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-5 sm:px-6 pt-5">
        <span
          className="grid place-items-center w-11 h-11 rounded-xl shrink-0 bg-paprika/12 text-paprika-deep font-display text-base leading-none"
          style={{ fontWeight: 700 }}
        >
          {store.displayName.slice(0, 2).toUpperCase()}
        </span>
        <h3 className="font-display text-ink text-xl leading-none truncate" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          {store.displayName}
        </h3>
        <span className="ml-auto font-mono text-[0.6rem] text-chestnut-soft uppercase tracking-[0.12em]">{store.storeCode}</span>
      </div>

      {/* Capability rows */}
      <div className="mt-4 divide-y divide-cream-shadow/70 border-t border-cream-shadow/70">
        {/* Promotions — editable */}
        <div className="px-5 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="eyebrow">Promotions</span>
              {store.lastRunStatus != null && (
                <span className={`font-mono px-2 py-0.5 rounded-full text-[0.54rem] uppercase tracking-[0.1em] ${statusPill(store.lastRunStatus)}`}>
                  {HARVEST_STATUS_LABELS[store.lastRunStatus]}
                </span>
              )}
            </div>
            <Toggle
              checked={store.enabled}
              disabled={toggle.isPending}
              onChange={(v) => toggle.mutate(v)}
              label={store.enabled ? 'On' : 'Off'}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 mt-3">
            <p className="font-mono text-[0.64rem] text-chestnut">
              {store.lastRunAt ? (
                <>
                  {relativeDay(store.lastRunAt)} · {store.promotionCount} cached
                </>
              ) : store.enabled ? (
                <span className="text-chestnut-soft">on — never refreshed</span>
              ) : (
                <span className="text-chestnut-soft">off — turn on to pull bonus offers</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => refresh.mutate()}
              disabled={busy}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 sm:py-2 bg-butter text-[#1f2417] hover:bg-butter-deep disabled:opacity-60 transition-colors font-display font-semibold text-[0.8rem]"
            >
              <span aria-hidden className={busy ? 'animate-spin' : ''}>↻</span>
              {busy ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        </div>

        {/* Recipes — read-only pointer to the Sources screen */}
        {hasRecipes && (
          <div className="px-5 sm:px-6 py-4 flex items-center gap-3">
            <span className="eyebrow">Recipes</span>
            <span className="font-mono text-[0.6rem] text-chestnut-soft">also a recipe source</span>
            <a
              href="#recipe-sites"
              className="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.14em] text-chestnut hover:text-paprika transition-colors no-underline"
            >
              Manage above ↑
            </a>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function SchedulePanel() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [animating, setAnimating] = useState(false)
  const scheduleQ = useQuery({ queryKey: ['promotion-schedule'], queryFn: () => promotionsApi.schedule.get() })
  const save = useMutation({
    mutationFn: (input: HarvestSchedule) => promotionsApi.schedule.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotion-schedule'] }),
  })

  const data = scheduleQ.data
  const summary = data ? (data.enabled ? `every ${DAY_LABELS[data.dayOfWeek]} at ${data.timeOfDay}` : 'off') : '…'

  return (
    <div className={`mb-6 rounded-xl border border-cream-shadow bg-cream ${open && !animating ? 'overflow-visible' : 'overflow-hidden'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cream-deep/50 transition-colors"
      >
        <span className="text-chestnut-soft shrink-0"><ClockIcon /></span>
        <span className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <span className="eyebrow">Auto-refresh</span>
          <span className={`font-mono text-[0.7rem] truncate ${data?.enabled ? 'text-chestnut' : 'text-chestnut-soft'}`}>{summary}</span>
        </span>
        <span className={`shrink-0 w-2 h-2 rounded-full ${data?.enabled ? 'bg-paprika' : 'bg-chestnut-soft'}`} aria-hidden />
        <span className="shrink-0 text-chestnut-soft"><Chevron open={open} /></span>
      </button>

      <AnimatePresence initial={false}>
        {open && data && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            onAnimationStart={() => setAnimating(true)}
            onAnimationComplete={() => setAnimating(false)}
            className={animating ? 'overflow-hidden' : 'overflow-visible'}
          >
            <div className="px-4 pb-5 pt-2 border-t border-cream-shadow/70">
              <ScheduleForm
                key={`${data.enabled}-${data.dayOfWeek}-${data.timeOfDay}`}
                initial={data}
                saving={save.isPending}
                onSave={(input) => save.mutate(input)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ScheduleForm({ initial, saving, onSave }: { initial: HarvestSchedule; saving: boolean; onSave: (s: HarvestSchedule) => void }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [dayOfWeek, setDayOfWeek] = useState(String(initial.dayOfWeek))
  const [timeOfDay, setTimeOfDay] = useState(initial.timeOfDay)

  const dirty = enabled !== initial.enabled || Number(dayOfWeek) !== initial.dayOfWeek || timeOfDay !== initial.timeOfDay

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-ink-soft text-sm leading-snug max-w-xs">
          {enabled ? 'Refreshes every enabled store automatically.' : 'Only refreshes when you press “Refresh now”.'}
        </p>
        <Toggle label={enabled ? 'On' : 'Off'} checked={enabled} onChange={setEnabled} />
      </div>

      <div className={['grid grid-cols-2 gap-x-5 gap-y-4', enabled ? '' : 'opacity-50 pointer-events-none'].join(' ')}>
        <label className="col-span-2 sm:col-span-1 block">
          <span className="eyebrow block mb-1.5">Day</span>
          <Listbox ariaLabel="Refresh day" value={dayOfWeek} onChange={setDayOfWeek} options={DAY_OPTIONS} />
        </label>
        <label className="col-span-2 sm:col-span-1 block">
          <span className="eyebrow block mb-1.5">Time</span>
          <TimePicker value={timeOfDay} onChange={setTimeOfDay} />
        </label>
      </div>

      <div className="flex items-center gap-4 mt-5">
        <button
          type="button"
          onClick={() => onSave({ enabled, dayOfWeek: Number(dayOfWeek), timeOfDay })}
          disabled={saving || !dirty}
          className="inline-flex items-center rounded-lg px-4 py-2 bg-paprika text-cream hover:bg-paprika-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-display font-semibold text-[0.82rem]"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {!dirty && !saving && <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-chestnut-soft">Saved</span>}
      </div>
    </div>
  )
}

function RunHistory() {
  const [open, setOpen] = useState(false)
  const runsQ = useQuery({
    queryKey: RUNS_KEY,
    queryFn: () => promotionsApi.integrations.runs(),
    enabled: open,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === HARVEST_STATUS_PROCESSING) ? 1500 : false),
  })
  const runs = runsQ.data ?? []

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-chestnut hover:text-paprika transition-colors"
      >
        <HistoryIcon />
        {open ? 'Hide refresh history' : 'Refresh history'}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden"
          >
            <div className="mt-4">
              {runsQ.isPending && <p className="font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>}
              {runsQ.isSuccess && runs.length === 0 && (
                <p className="font-mono text-[0.66rem] text-chestnut-soft">No refreshes recorded yet.</p>
              )}
              {runs.length > 0 && <RunsTable runs={runs} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RunsTable({ runs }: { runs: HarvestReport[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const th = 'px-3 py-2 font-normal'

  return (
    <div className="rounded-xl border border-cream-shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-cream-deep font-mono text-[0.55rem] uppercase tracking-[0.12em] text-chestnut-soft">
              <th className={th}>When</th>
              <th className={`${th} hidden sm:table-cell`}>Run</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Cached</th>
              <th className={`${th} text-right`}>Fail</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const hasDetail = run.sources.length > 0
              const isOpen = expanded.has(run.runId)
              return (
                <Fragment key={run.runId}>
                  <tr
                    onClick={hasDetail ? () => toggle(run.runId) : undefined}
                    className={['border-t border-cream-shadow', hasDetail ? 'cursor-pointer hover:bg-cream-deep/50' : ''].join(' ')}
                  >
                    <td className="px-3 py-2.5 font-mono text-[0.62rem] text-ink whitespace-nowrap">
                      {new Date(run.startedAt).toLocaleDateString()}
                      <span className="hidden sm:inline text-chestnut-soft">
                        {' · '}
                        {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[0.62rem] text-chestnut hidden sm:table-cell">
                      {HARVEST_TRIGGER_LABELS[run.trigger]}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`font-mono text-[0.54rem] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full ${statusPill(run.status)}`}>
                        {HARVEST_STATUS_LABELS[run.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right num text-[0.8rem] text-paprika">{run.inserted}</td>
                    <td className={`px-3 py-2.5 text-right num text-[0.8rem] ${run.failed > 0 ? 'text-red-600' : 'text-chestnut-soft'}`}>
                      {run.failed}
                    </td>
                    <td className="px-2 py-2.5 text-chestnut-soft">{hasDetail && <Chevron open={isOpen} />}</td>
                  </tr>

                  {hasDetail && isOpen && (
                    <tr className="bg-cream">
                      <td colSpan={6} className="px-3 sm:px-4 py-4 border-t border-cream-shadow/60">
                        <div className="space-y-2">
                          {run.sources.map((src, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 font-mono text-[0.62rem]">
                              <span className="text-chestnut">{src.sourceName || src.host}</span>
                              {src.error ? (
                                <span className="text-red-600 text-right break-words">{src.error}</span>
                              ) : (
                                <span className="text-paprika-deep">{src.inserted} cached</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hh, mm] = (value || '00:00').split(':')
  const hour = hh ?? '00'
  const minute = mm ?? '00'

  const hourOptions: ListboxOption[] = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ value: pad2(i), label: pad2(i) })),
    [],
  )
  const minuteOptions: ListboxOption[] = useMemo(() => {
    const set = new Set<number>([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    set.add(Number(minute))
    return [...set].sort((a, b) => a - b).map((n) => ({ value: pad2(n), label: pad2(n) }))
  }, [minute])

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <Listbox ariaLabel="Hour" value={hour} onChange={(h) => onChange(`${h}:${minute}`)} options={hourOptions} />
      </div>
      <span className="text-chestnut-soft font-mono shrink-0">:</span>
      <div className="flex-1 min-w-0">
        <Listbox ariaLabel="Minute" value={minute} onChange={(m) => onChange(`${hour}:${m}`)} options={minuteOptions} />
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 group disabled:opacity-50"
    >
      <span className={['relative w-11 h-6 rounded-full transition-colors', checked ? 'bg-paprika' : 'bg-cream-shadow'].join(' ')}>
        <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream shadow-sm transition-transform', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </span>
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-chestnut group-hover:text-paprika transition-colors">{label}</span>
    </button>
  )
}

const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5 V8 L10.4 9.4" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.7 8 a5.3 5.3 0 1 1 1.6 3.8" />
      <path d="M2.4 11.5 4.3 11.6 4.2 9.7" />
      <path d="M8 5.2 V8 L10 9.3" />
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
