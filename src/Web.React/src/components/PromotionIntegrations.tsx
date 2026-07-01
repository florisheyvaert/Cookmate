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
import { Dialog } from '@/components/Dialog'
import { GroupHeader } from '@/components/SettingsGroup'

const ease = [0.22, 1, 0.36, 1] as const
const INTEGRATIONS_KEY = ['promotion-integrations']
const RUNS_KEY = ['promotion-runs']

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_OPTIONS: ListboxOption[] = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: DAY_LABELS[d] }))

// Brand → recipe-source host labels, so a store that is *also* a recipe source shows both
// capabilities on one row. Matching is by the host's first label (ah.be → "ah").
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
 * The "Promotions" group of the Integrations section: which stores Cookmate caches the
 * weekly bonus from. A titled group with a borderless auto-refresh summary row and one
 * flat, divided row per store (toggle + refresh), plus a run-history dialog — mirroring
 * the Recipe sources group so the two read as one calm, consistent list.
 */
export function PromotionIntegrations() {
  const [historyOpen, setHistoryOpen] = useState(false)
  const integrationsQ = useQuery({
    queryKey: INTEGRATIONS_KEY,
    queryFn: () => promotionsApi.integrations.list(),
    // Keep the row live while a refresh is running server-side.
    refetchInterval: (q) =>
      q.state.data?.some((s) => s.lastRunStatus === HARVEST_STATUS_PROCESSING) ? 2500 : false,
  })
  // Used only to detect which stores are also recipe sources (for the inline note).
  const sourcesQ = useQuery({ queryKey: ['suggestion-sources'], queryFn: () => suggestionsApi.sources.list() })

  const stores = integrationsQ.data ?? []
  const recipeHosts = (sourcesQ.data ?? []).map((s) => s.host.toLowerCase())

  function recipeSourceFor(storeCode: string): boolean {
    const hints = RECIPE_HOST_HINTS[storeCode] ?? [storeCode]
    return recipeHosts.some((host) => hints.some((h) => host.split('.')[0] === h || host.includes(`${h}.`)))
  }

  return (
    <section>
      <GroupHeader
        icon="🏷️"
        tint="butter"
        title="Promotions"
        description="Stores whose weekly bonus Cookmate caches — switch one on and set when it refreshes on its own."
        action={
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-chestnut hover:text-paprika transition-colors"
          >
            <HistoryIcon />
            History
          </button>
        }
      />

      <ScheduleRow />

      {integrationsQ.isPending ? (
        <p className="mt-6 font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>
      ) : stores.length === 0 ? (
        <p className="mt-6 text-ink-soft leading-relaxed">No stores support promotions yet. They'll appear here as they're added.</p>
      ) : (
        <ul className="mt-2 border-t border-cream-shadow divide-y divide-cream-shadow">
          {stores.map((store, i) => (
            <ProviderRow key={store.storeCode} store={store} index={i} hasRecipes={recipeSourceFor(store.storeCode)} />
          ))}
        </ul>
      )}

      <PromoHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </section>
  )
}

function ProviderRow({ store, index, hasRecipes }: { store: PromotionIntegration; index: number; hasRecipes: boolean }) {
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
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3, ease }}
      className="py-4 sm:py-5"
    >
      <div className="flex items-start gap-3.5">
        <span
          className={[
            'grid place-items-center w-11 h-11 rounded-xl shrink-0 font-display text-base leading-none',
            store.enabled ? 'bg-butter/20 text-butter-deep' : 'bg-cream-shadow text-chestnut',
          ].join(' ')}
          style={{ fontWeight: 700 }}
        >
          {store.displayName.slice(0, 2).toUpperCase()}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-display text-ink text-lg leading-none truncate" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              {store.displayName}
            </h4>
            <span className="font-mono text-[0.58rem] text-chestnut-soft uppercase tracking-[0.12em]">{store.storeCode}</span>
            {store.lastRunStatus != null && (
              <span className={`font-mono px-2 py-0.5 rounded-full text-[0.54rem] uppercase tracking-[0.1em] ${statusPill(store.lastRunStatus)}`}>
                {HARVEST_STATUS_LABELS[store.lastRunStatus]}
              </span>
            )}
          </div>
          <p className="font-mono text-[0.64rem] text-chestnut mt-2">
            {store.lastRunAt ? (
              <>
                {relativeDay(store.lastRunAt)} · {store.promotionCount} cached
              </>
            ) : store.enabled ? (
              <span className="text-chestnut-soft">on — never refreshed</span>
            ) : (
              <span className="text-chestnut-soft">off — turn on to pull bonus offers</span>
            )}
            {hasRecipes && (
              <>
                <span aria-hidden className="text-chestnut-soft"> · </span>
                also a recipe source{' '}
                <a href="#recipe-sites" className="text-chestnut hover:text-paprika transition-colors no-underline">
                  ↑
                </a>
              </>
            )}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2.5">
          <Toggle checked={store.enabled} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} label={store.enabled ? 'On' : 'Off'} />
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={busy || !store.enabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 bg-butter text-[#1f2417] hover:bg-butter-deep disabled:opacity-50 transition-colors font-display font-semibold text-[0.78rem]"
          >
            <span aria-hidden className={busy ? 'inline-block animate-spin' : ''}>↻</span>
            <span className="hidden sm:inline">{busy ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </motion.li>
  )
}

// ── Auto-refresh schedule — a borderless summary row that expands in place ──────

function ScheduleRow() {
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
    <div className={`mt-5 ${open && !animating ? 'overflow-visible' : 'overflow-hidden'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group w-full flex items-center gap-2.5 py-1 text-left"
      >
        <span className="text-chestnut-soft shrink-0"><ClockIcon /></span>
        <span className="eyebrow shrink-0">Auto-refresh</span>
        <span className={`font-mono text-[0.68rem] truncate ${data?.enabled ? 'text-chestnut' : 'text-chestnut-soft'}`}>{summary}</span>
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${data?.enabled ? 'bg-paprika' : 'bg-chestnut-soft'}`} aria-hidden />
        <span className="ml-auto shrink-0 text-chestnut-soft group-hover:text-paprika transition-colors"><Chevron open={open} /></span>
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
            <div className="pt-3 pb-1">
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
          {enabled ? 'Refreshes every enabled store automatically.' : 'Only refreshes when you press “Refresh”.'}
        </p>
        <Toggle label={enabled ? 'On' : 'Off'} checked={enabled} onChange={setEnabled} />
      </div>

      <div className={['grid grid-cols-2 gap-x-5 gap-y-4 max-w-md', enabled ? '' : 'opacity-50 pointer-events-none'].join(' ')}>
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

// ── Refresh history dialog ─────────────────────────────────────────────────────

function PromoHistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const runsQ = useQuery({
    queryKey: RUNS_KEY,
    queryFn: () => promotionsApi.integrations.runs(),
    enabled: open,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === HARVEST_STATUS_PROCESSING) ? 1500 : false),
  })
  const runs = runsQ.data ?? []

  return (
    <Dialog open={open} onClose={onClose} eyebrow="Refresh history" title="Store promotions" maxWidth="max-w-2xl">
      {runsQ.isPending ? (
        <p className="font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="font-mono text-[0.66rem] text-chestnut-soft">No refreshes recorded yet.</p>
      ) : (
        <RunsTable runs={runs} />
      )}
    </Dialog>
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
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-chestnut-soft">
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
                  className={['border-t border-cream-shadow', hasDetail ? 'cursor-pointer hover:bg-cream-deep/60' : ''].join(' ')}
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
                  <tr className="bg-cream-deep/50">
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
