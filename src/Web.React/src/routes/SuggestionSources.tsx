import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  suggestionsApi,
  type HarvestReport,
  type HarvestSchedule,
  type SuggestionSourceDto,
  type SuggestionSourceInput,
  HARVEST_STATUS_LABELS,
  HARVEST_STATUS_PROCESSING,
  HARVEST_TRIGGER_LABELS,
} from '@/api/suggestions'
import { Listbox, type ListboxOption } from '@/components/Listbox'
import { Dialog } from '@/components/Dialog'
import { GroupHeader } from '@/components/SettingsGroup'
import { btnPrimarySm } from '@/lib/ui'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_OPTIONS: ListboxOption[] = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: DAY_LABELS[d] }))

const ease = [0.22, 1, 0.36, 1] as const
const SOURCES_KEY = ['suggestion-sources']
const DEFAULT_MAX_PER_RUN = 100

// 0 Succeeded · 1 Partial · 2 Failed · 3 Processing
function statusPill(status: number): string {
  if (status === HARVEST_STATUS_PROCESSING)
    return 'bg-cream-shadow/60 text-ink-soft ring-1 ring-inset ring-cream-shadow animate-pulse'
  if (status === 0) return 'bg-paprika/15 text-paprika-deep ring-1 ring-inset ring-paprika/30'
  if (status === 1) return 'bg-butter/25 text-[#7a5a12] ring-1 ring-inset ring-butter/50'
  return 'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-500/30'
}

function monogram(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}

// The source's own favicon when we have one, else a letter monogram.
function SourceMonogram({ name, faviconUrl, enabled }: { name: string; faviconUrl: string | null; enabled: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <span
      className={[
        'grid place-items-center w-11 h-11 rounded-xl shrink-0 overflow-hidden font-display text-lg leading-none',
        enabled ? 'bg-paprika/12 text-paprika-deep' : 'bg-cream-shadow text-chestnut',
      ].join(' ')}
      style={{ fontWeight: 700 }}
    >
      {faviconUrl && !broken ? (
        <img src={faviconUrl} alt="" className="w-6 h-6 object-contain" onError={() => setBroken(true)} />
      ) : (
        monogram(name)
      )}
    </span>
  )
}

/**
 * Recipe (meal-suggestion) sources — the sites Cookmate harvests recipe ideas from.
 * A titled group with a compact "Add source" that opens a dialog, a borderless
 * auto-harvest summary row, and one flat, divided row per source. Add/edit happen in
 * a dialog; each source's run history opens in a dialog too — so the page stays a calm
 * list rather than a stack of nested cards.
 */
export function RecipeSourcesPanel() {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; source: SuggestionSourceDto } | null>(null)
  const [historyFor, setHistoryFor] = useState<SuggestionSourceDto | null>(null)

  const sourcesQ = useQuery({
    queryKey: SOURCES_KEY,
    queryFn: () => suggestionsApi.sources.list(),
    // While any source is mid-harvest, poll so its "Processing" label + counts stay live.
    refetchInterval: (q) =>
      q.state.data?.some((s) => s.lastRunStatus === HARVEST_STATUS_PROCESSING) ? 2500 : false,
  })

  const create = useMutation({
    mutationFn: (input: SuggestionSourceInput) => suggestionsApi.sources.create(input),
    onSuccess: () => {
      setDialog(null)
      queryClient.invalidateQueries({ queryKey: SOURCES_KEY })
    },
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: SuggestionSourceInput }) => suggestionsApi.sources.update(id, input),
    onSuccess: () => {
      setDialog(null)
      queryClient.invalidateQueries({ queryKey: SOURCES_KEY })
    },
  })

  const sources = sourcesQ.data ?? []

  return (
    <section id="recipe-sites" className="scroll-mt-24">
      <GroupHeader
        icon="📖"
        tint="paprika"
        title="Recipe sources"
        description="Sites Cookmate harvests recipe ideas from — added by domain, recipe pages found automatically."
        action={
          <button type="button" onClick={() => setDialog({ mode: 'add' })} className={btnPrimarySm}>
            + Add source
          </button>
        }
      />

      <ScheduleRow />

      {sourcesQ.isPending ? (
        <p className="mt-6 font-mono text-[0.7rem] text-chestnut-soft">Loading…</p>
      ) : sources.length === 0 ? (
        <p className="mt-6 text-ink-soft">No sources yet — add one to start filling your ideas.</p>
      ) : (
        <ul className="mt-2 border-t border-cream-shadow divide-y divide-cream-shadow">
          {sources.map((source, i) => (
            <SourceRow
              key={source.id}
              source={source}
              index={i}
              onEdit={() => setDialog({ mode: 'edit', source })}
              onHistory={() => setHistoryFor(source)}
            />
          ))}
        </ul>
      )}

      <SourceDialog
        open={dialog != null}
        mode={dialog?.mode ?? 'add'}
        initial={dialog?.mode === 'edit' ? dialog.source : undefined}
        submitting={create.isPending || update.isPending}
        error={create.error ?? update.error}
        onClose={() => setDialog(null)}
        onSubmit={(input) =>
          dialog?.mode === 'edit' ? update.mutate({ id: dialog.source.id, input }) : create.mutate(input)
        }
      />

      <RunHistoryDialog source={historyFor} onClose={() => setHistoryFor(null)} />
    </section>
  )
}

function SourceRow({
  source,
  index,
  onEdit,
  onHistory,
}: {
  source: SuggestionSourceDto
  index: number
  onEdit: () => void
  onHistory: () => void
}) {
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: (input: SuggestionSourceInput) => suggestionsApi.sources.update(source.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCES_KEY }),
  })
  const remove = useMutation({
    mutationFn: () => suggestionsApi.sources.remove(source.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCES_KEY }),
  })
  const harvest = useMutation({
    mutationFn: () => suggestionsApi.sources.harvest(source.id),
    // Pop the history open so the run appears (and climbs) while it works.
    onMutate: () => onHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['harvest-runs', source.id] })
      queryClient.invalidateQueries({ queryKey: SOURCES_KEY })
      queryClient.invalidateQueries({ queryKey: ['meal-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-ideas'] })
    },
  })

  // A harvest survives a page refresh server-side, so drive busy off the persisted
  // "Processing" status too — not just this tab's in-flight mutation.
  const processing = source.lastRunStatus === HARVEST_STATUS_PROCESSING
  const busy = harvest.isPending || processing

  function patch(changes: Partial<SuggestionSourceInput>) {
    update.mutate({
      name: source.name,
      host: source.host,
      enabled: source.enabled,
      listingUrls: [],
      maxPerRun: source.maxPerRun,
      ...changes,
    })
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.3, ease }}
      className="py-4 sm:py-5"
    >
      <div className="flex items-start gap-3.5">
        <SourceMonogram name={source.name} faviconUrl={source.faviconUrl} enabled={source.enabled} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-display text-ink text-lg leading-none truncate" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              {source.name}
            </h4>
            {!source.enabled && (
              <span className="font-mono text-[0.54rem] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-cream-shadow text-chestnut">
                Off
              </span>
            )}
            {source.lastRunStatus != null && (
              <span className={`whitespace-nowrap font-mono px-2 py-0.5 rounded-full text-[0.54rem] uppercase tracking-[0.1em] ${statusPill(source.lastRunStatus)}`}>
                {HARVEST_STATUS_LABELS[source.lastRunStatus]}
              </span>
            )}
          </div>
          <p className="font-mono text-[0.68rem] text-chestnut-soft mt-1 truncate">{source.host}</p>
          <p className="font-mono text-[0.64rem] text-chestnut mt-2">
            {source.maxPerRun != null ? `cap ${source.maxPerRun}/run` : 'no cap'}
            {source.lastRunAt ? (
              <>
                <span aria-hidden className="text-chestnut-soft"> · </span>
                {new Date(source.lastRunAt).toLocaleDateString()} · {source.lastRunCount ?? 0} added
              </>
            ) : (
              <span className="text-chestnut-soft"> · never harvested</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => harvest.mutate()}
          disabled={busy}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 bg-butter text-[#1f2417] hover:bg-butter-deep disabled:opacity-60 transition-colors font-display font-semibold text-[0.78rem]"
        >
          <span aria-hidden className={busy ? 'inline-block animate-spin' : ''}>⟳</span>
          <span className="hidden sm:inline">{busy ? 'Harvesting…' : 'Harvest'}</span>
        </button>
      </div>

      {/* Quiet actions — no card, just a row */}
      <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-1 mt-2.5 pl-[3.75rem]">
        <ActionBtn
          icon={<PowerIcon />}
          label={source.enabled ? 'Disable' : 'Enable'}
          onClick={() => patch({ enabled: !source.enabled })}
          disabled={update.isPending}
        />
        <ActionBtn icon={<PencilIcon />} label="Edit" onClick={onEdit} />
        <ActionBtn icon={<HistoryIcon />} label="History" onClick={onHistory} />
        <div className="ml-auto">
          <ActionBtn
            icon={<TrashIcon />}
            label="Delete"
            danger
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Delete "${source.name}" and its harvested suggestions?`)) remove.mutate()
            }}
          />
        </div>
      </div>
    </motion.li>
  )
}

// ── Auto-harvest schedule — a borderless summary row that expands in place ──────

function ScheduleRow() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // Clip during the height animation, but let overflow show once settled so the Day
  // dropdown isn't cut off by the collapsible container.
  const [animating, setAnimating] = useState(false)
  const scheduleQ = useQuery({ queryKey: ['harvest-schedule'], queryFn: () => suggestionsApi.schedule.get() })
  const save = useMutation({
    mutationFn: (input: HarvestSchedule) => suggestionsApi.schedule.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['harvest-schedule'] }),
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
        <span className="text-chestnut-soft shrink-0">
          <ClockIcon />
        </span>
        <span className="eyebrow shrink-0">Auto-harvest</span>
        <span className={`font-mono text-[0.68rem] truncate ${data?.enabled ? 'text-chestnut' : 'text-chestnut-soft'}`}>{summary}</span>
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${data?.enabled ? 'bg-paprika' : 'bg-chestnut-soft'}`} aria-hidden />
        <span className="ml-auto shrink-0 text-chestnut-soft group-hover:text-paprika transition-colors">
          <Chevron open={open} />
        </span>
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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Custom, themed time picker (hour + minute listboxes) — closes on select, no native control. */
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

function ScheduleForm({ initial, saving, onSave }: { initial: HarvestSchedule; saving: boolean; onSave: (s: HarvestSchedule) => void }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [dayOfWeek, setDayOfWeek] = useState(String(initial.dayOfWeek))
  const [timeOfDay, setTimeOfDay] = useState(initial.timeOfDay)

  const dirty = enabled !== initial.enabled || Number(dayOfWeek) !== initial.dayOfWeek || timeOfDay !== initial.timeOfDay

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-ink-soft text-sm leading-snug max-w-xs">
          {enabled ? 'Runs automatically across all enabled sources.' : 'Only fetches when you press “Harvest”.'}
        </p>
        <Toggle label={enabled ? 'On' : 'Off'} checked={enabled} onChange={setEnabled} />
      </div>

      <div className={['grid grid-cols-2 gap-x-5 gap-y-4 max-w-md', enabled ? '' : 'opacity-50 pointer-events-none'].join(' ')}>
        <label className="col-span-2 sm:col-span-1 block">
          <span className="eyebrow block mb-1.5">Day</span>
          <Listbox ariaLabel="Harvest day" value={dayOfWeek} onChange={setDayOfWeek} options={DAY_OPTIONS} />
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

function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors disabled:opacity-50',
        danger ? 'text-red-600 hover:text-red-700' : 'text-chestnut hover:text-paprika',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  )
}

// ── Add / edit source dialog ───────────────────────────────────────────────────

function SourceDialog({
  open,
  mode,
  initial,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'add' | 'edit'
  initial?: SuggestionSourceDto
  submitting: boolean
  error: unknown
  onClose: () => void
  onSubmit: (input: SuggestionSourceInput) => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={mode === 'edit' ? 'Edit source' : 'New source'}
      title={mode === 'edit' ? (initial?.name ?? 'Source') : 'Add a recipe source'}
      maxWidth="max-w-lg"
    >
      <SourceFields
        key={initial?.id ?? 'new'}
        initial={initial}
        submitting={submitting}
        error={error}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Dialog>
  )
}

function SourceFields({
  initial,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: SuggestionSourceDto
  submitting: boolean
  error: unknown
  onSubmit: (input: SuggestionSourceInput) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [host, setHost] = useState(initial?.host ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [maxPerRun, setMaxPerRun] = useState(
    initial ? (initial.maxPerRun != null ? String(initial.maxPerRun) : '') : String(DEFAULT_MAX_PER_RUN),
  )

  function submit() {
    onSubmit({
      name: name.trim(),
      host: host.trim(),
      enabled,
      listingUrls: [],
      maxPerRun: maxPerRun.trim() ? Number(maxPerRun) : null,
    })
  }

  const field =
    'w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 text-ink transition-colors'

  return (
    <div>
      <div className="grid grid-cols-12 gap-x-5 gap-y-6">
        <label className="col-span-12 block">
          <span className="eyebrow block mb-1.5">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dagelijkse Kost" className={`${field} font-display text-xl`} />
        </label>

        <label className="col-span-12 block">
          <span className="eyebrow block mb-1.5">Domain</span>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="dagelijksekost.vrt.be" className={`${field} font-mono text-sm`} />
          <span className="block font-mono text-[0.6rem] text-chestnut-soft mt-1.5">
            Just the host — recipe pages are found via its sitemap.
          </span>
        </label>

        <label className="col-span-6 block">
          <span className="eyebrow block mb-1.5">Max / run</span>
          <input
            value={maxPerRun}
            onChange={(e) => setMaxPerRun(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="no limit"
            className={`${field} num text-lg`}
          />
          <span className="block font-mono text-[0.6rem] text-chestnut-soft mt-1.5">Empty = no limit.</span>
        </label>

        <div className="col-span-6 flex items-start pt-6">
          <Toggle label={enabled ? 'Enabled' : 'Disabled'} checked={enabled} onChange={setEnabled} />
        </div>
      </div>

      {error != null && (
        <p className="mt-5 font-mono text-[0.7rem] text-red-600">Could not save — check the name and domain, then try again.</p>
      )}

      <div className="flex items-center justify-end gap-4 mt-8">
        <button type="button" onClick={onCancel} className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !name.trim() || !host.trim()}
          className="inline-flex items-center rounded-xl px-6 py-2.5 bg-paprika text-cream hover:bg-paprika-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-display font-semibold text-[0.9rem]"
        >
          {submitting ? 'Saving…' : 'Save source'}
        </button>
      </div>
    </div>
  )
}

// ── Run history dialog ─────────────────────────────────────────────────────────

function RunHistoryDialog({ source, onClose }: { source: SuggestionSourceDto | null; onClose: () => void }) {
  const runsQ = useQuery({
    queryKey: ['harvest-runs', source?.id],
    queryFn: () => suggestionsApi.sources.runs(source!.id),
    enabled: source != null,
    // Poll while a run is active so In/Fail/Skip update live; stop once it finishes.
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === HARVEST_STATUS_PROCESSING) ? 1500 : false),
  })
  const runs = runsQ.data ?? []

  return (
    <Dialog open={source != null} onClose={onClose} eyebrow="Harvest history" title={source?.name ?? ''} maxWidth="max-w-2xl">
      {runsQ.isPending ? (
        <p className="font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="font-mono text-[0.66rem] text-chestnut-soft">No runs recorded yet.</p>
      ) : (
        <HarvestRunsTable runs={runs} />
      )}
    </Dialog>
  )
}

function HarvestRunsTable({ runs }: { runs: HarvestReport[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [copied, setCopied] = useState<number | null>(null)

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copyReport(run: HarvestReport) {
    try {
      await navigator.clipboard.writeText(buildFailureText(run))
      setCopied(run.runId)
      setTimeout(() => setCopied((c) => (c === run.runId ? null : c)), 2000)
    } catch {
      /* clipboard blocked — ignore */
    }
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
            <th className={`${th} text-right`}>In</th>
            <th className={`${th} text-right`}>Fail</th>
            <th className={`${th} text-right hidden sm:table-cell`}>Skip</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const hasFailures = run.failed > 0
            const isOpen = expanded.has(run.runId)
            return (
              <Fragment key={run.runId}>
                <tr
                  onClick={hasFailures ? () => toggle(run.runId) : undefined}
                  className={['border-t border-cream-shadow', hasFailures ? 'cursor-pointer hover:bg-cream-deep/60' : ''].join(' ')}
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
                  <td className="px-3 py-2.5 text-right num text-[0.8rem] text-chestnut hidden sm:table-cell">{run.skippedDuplicate}</td>
                  <td className="px-2 py-2.5 text-chestnut-soft">{hasFailures && <Chevron open={isOpen} />}</td>
                </tr>

                {hasFailures && isOpen && (
                  <tr className="bg-cream-deep/50">
                    <td colSpan={7} className="px-3 sm:px-4 py-4 border-t border-cream-shadow/60">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="eyebrow text-red-600">Errors · {run.failed}</p>
                        <button
                          type="button"
                          onClick={() => copyReport(run)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors font-mono text-[0.6rem] uppercase tracking-[0.14em]"
                        >
                          {copied === run.runId ? '✓ Copied' : '⧉ Copy report'}
                        </button>
                      </div>

                      <div className="space-y-4">
                        {run.sources.map((src, i) => {
                          const failures = src.items.filter((it) => it.status === 2)
                          if (!src.error && failures.length === 0) return null
                          return (
                            <div key={i}>
                              <p className="font-mono text-[0.64rem] text-chestnut mb-1.5">
                                {src.sourceName || src.host} <span className="text-chestnut-soft">· {src.host}</span>
                              </p>
                              {src.error && <ErrorBlock label="Discovery failed" text={src.error} />}
                              {failures.map((it, j) => (
                                <ErrorBlock key={j} label={it.url} text={it.error ?? '(no message)'} />
                              ))}
                            </div>
                          )
                        })}
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

function ErrorBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-1.5">
      <p className="font-mono text-[0.6rem] text-red-600 break-words mb-1">{label}</p>
      <pre className="font-mono text-[0.62rem] leading-relaxed text-ink-soft bg-cream border border-cream-shadow rounded-lg p-2.5 max-h-56 overflow-auto whitespace-pre-wrap break-words select-text">
        {text}
      </pre>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Builds a copy-pasteable failure report for a run — source, URL and full error per failure. */
function buildFailureText(run: HarvestReport): string {
  const lines: string[] = []
  lines.push(`Harvest run #${run.runId} — ${HARVEST_TRIGGER_LABELS[run.trigger]} — ${new Date(run.startedAt).toLocaleString()}`)
  lines.push(`Status ${HARVEST_STATUS_LABELS[run.status]} · discovered ${run.discovered}, inserted ${run.inserted}, skipped ${run.skippedDuplicate}, failed ${run.failed}`)

  for (const src of run.sources) {
    const failures = src.items.filter((it) => it.status === 2)
    if (!src.error && failures.length === 0) continue
    lines.push('')
    lines.push(`Source: ${src.sourceName || src.host} (${src.host})`)
    if (src.error) {
      lines.push('Discovery failed:')
      lines.push(src.error)
    }
    for (const it of failures) {
      lines.push('')
      lines.push(`URL: ${it.url}`)
      lines.push(it.error ?? '(no message)')
    }
  }

  return lines.join('\n')
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3 group">
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

function PowerIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 2.2 V8" />
      <path d="M5 4.3 a4.4 4.4 0 1 0 6 0" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.8 2.6 13.4 5.2 5.7 12.9 3 13.4 3.5 10.7 Z" />
      <path d="M9.6 3.8 12.2 6.4" />
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

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 4.4 H13" />
      <path d="M5.6 4.4 V3.3 H10.4 V4.4" />
      <path d="M4.4 4.4 4.9 13 H11.1 L11.6 4.4" />
      <path d="M6.6 6.6 V11" />
      <path d="M9.4 6.6 V11" />
    </svg>
  )
}
