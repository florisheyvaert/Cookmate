import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  suggestionsApi,
  type HarvestReport,
  type SuggestionSourceDto,
  type SuggestionSourceInput,
  HARVEST_STATUS_LABELS,
  HARVEST_ITEM_STATUS_LABELS,
  HARVEST_TRIGGER_LABELS,
} from '@/api/suggestions'
import { PageHeader } from '@/components/PageHeader'

const ease = [0.22, 1, 0.36, 1] as const
const SOURCES_KEY = ['suggestion-sources']
const DEFAULT_MAX_PER_RUN = 100

// 0 Succeeded · 1 Partial · 2 Failed
function statusPill(status: number): string {
  if (status === 0) return 'bg-paprika/15 text-paprika-deep ring-1 ring-inset ring-paprika/30'
  if (status === 1) return 'bg-butter/25 text-[#7a5a12] ring-1 ring-inset ring-butter/50'
  return 'bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-500/30'
}

function monogram(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}

export default function SuggestionSources() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const sourcesQ = useQuery({ queryKey: SOURCES_KEY, queryFn: () => suggestionsApi.sources.list() })

  const create = useMutation({
    mutationFn: (input: SuggestionSourceInput) => suggestionsApi.sources.create(input),
    onSuccess: () => {
      setAdding(false)
      queryClient.invalidateQueries({ queryKey: SOURCES_KEY })
    },
  })

  const sources = sourcesQ.data ?? []

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-20">
      <PageHeader
        eyebrow="Discover · Sources"
        title="Sources"
        subtitle="Sites the weekly harvester scrapes for meal ideas. Add a site by its domain — the rest is found automatically."
        action={
          <Link
            to="/suggestions"
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors font-mono text-[0.7rem] uppercase tracking-[0.16em] no-underline"
          >
            ← Back to ideas
          </Link>
        }
      />

      {/* Add */}
      <div className="mb-9">
        <AnimatePresence initial={false} mode="wait">
          {adding ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease }}
            >
              <SourceForm
                heading="New source"
                submitting={create.isPending}
                error={create.error}
                onCancel={() => setAdding(false)}
                onSubmit={(input) => create.mutate(input)}
              />
            </motion.div>
          ) : (
            <motion.button
              key="add-btn"
              type="button"
              onClick={() => setAdding(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group w-full flex items-center gap-4 rounded-2xl border border-dashed border-cream-shadow bg-cream-deep/40 px-6 py-5 text-left hover:border-paprika/60 hover:bg-paprika-tint/40 transition-colors"
            >
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-paprika text-cream text-xl leading-none shrink-0">
                +
              </span>
              <span>
                <span className="block font-display text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Add a source
                </span>
                <span className="block font-mono text-[0.66rem] text-chestnut-soft mt-0.5">
                  e.g. dagelijksekost.vrt.be · ah.nl · libelle-lekker.be
                </span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Overview */}
      {sourcesQ.isPending ? (
        <p className="font-mono text-[0.7rem] text-chestnut-soft">Loading…</p>
      ) : sources.length === 0 && !adding ? (
        <p className="text-ink-soft text-lg">No sources yet — add one above to start filling the catalog.</p>
      ) : (
        <div className="space-y-4">
          {sources.map((source, i) => (
            <SourceCard key={source.id} source={source} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function SourceCard({ source, index }: { source: SuggestionSourceDto; index: number }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showRuns, setShowRuns] = useState(false)
  const [report, setReport] = useState<HarvestReport | null>(null)

  const update = useMutation({
    mutationFn: (input: SuggestionSourceInput) => suggestionsApi.sources.update(source.id, input),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: SOURCES_KEY })
    },
  })
  const remove = useMutation({
    mutationFn: () => suggestionsApi.sources.remove(source.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCES_KEY }),
  })
  const harvest = useMutation({
    mutationFn: () => suggestionsApi.sources.harvest(source.id),
    onSuccess: (r) => {
      setReport(r)
      queryClient.invalidateQueries({ queryKey: SOURCES_KEY })
      queryClient.invalidateQueries({ queryKey: ['meal-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['weekly-ideas'] })
    },
  })
  const runsQ = useQuery({
    queryKey: ['harvest-runs', source.id],
    queryFn: () => suggestionsApi.sources.runs(source.id),
    enabled: showRuns,
  })

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

  if (editing) {
    return (
      <SourceForm
        heading="Edit source"
        initial={source}
        submitting={update.isPending}
        error={update.error}
        onCancel={() => setEditing(false)}
        onSubmit={(input) => update.mutate(input)}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.35, ease }}
      className="rounded-2xl border border-cream-shadow bg-cream-deep overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Monogram */}
          <span
            className={[
              'grid place-items-center w-12 h-12 rounded-xl shrink-0 font-display text-xl leading-none',
              source.enabled ? 'bg-paprika/12 text-paprika-deep' : 'bg-cream-shadow text-chestnut',
            ].join(' ')}
            style={{ fontWeight: 700 }}
          >
            {monogram(source.name)}
          </span>

          {/* Identity + telemetry */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-ink text-xl leading-none truncate" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                {source.name}
              </h2>
              <StatusDot enabled={source.enabled} />
            </div>
            <p className="font-mono text-[0.7rem] text-chestnut-soft mt-1.5 truncate">{source.host}</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 font-mono text-[0.64rem] text-chestnut">
              <span>{source.maxPerRun != null ? `cap ${source.maxPerRun}/run` : 'no cap'}</span>
              {source.lastRunAt ? (
                <span className="inline-flex items-center gap-1.5">
                  last run {new Date(source.lastRunAt).toLocaleDateString()} · {source.lastRunCount ?? 0} added
                  {source.lastRunStatus != null && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[0.56rem] uppercase tracking-[0.1em] ${statusPill(source.lastRunStatus)}`}>
                      {HARVEST_STATUS_LABELS[source.lastRunStatus]}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-chestnut-soft">never harvested</span>
              )}
            </div>
          </div>

          {/* Primary action */}
          <button
            type="button"
            onClick={() => harvest.mutate()}
            disabled={harvest.isPending}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 bg-butter text-[#1f2417] hover:bg-butter-deep disabled:opacity-60 transition-colors font-display font-semibold text-[0.82rem]"
          >
            {harvest.isPending ? 'Harvesting…' : '⟳ Harvest now'}
          </button>
        </div>

        {/* Secondary actions */}
        <div className="flex items-center gap-5 mt-4 pt-4 border-t border-cream-shadow/70">
          <ActionBtn
            icon={<PowerIcon />}
            label={source.enabled ? 'Disable' : 'Enable'}
            onClick={() => patch({ enabled: !source.enabled })}
            disabled={update.isPending}
          />
          <ActionBtn icon={<PencilIcon />} label="Edit" onClick={() => setEditing(true)} />
          <ActionBtn
            icon={<HistoryIcon />}
            label={showRuns ? 'Hide history' : 'History'}
            onClick={() => setShowRuns((v) => !v)}
          />
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

        {/* Live report after a manual harvest */}
        {report && (
          <div className="mt-5">
            <p className="eyebrow mb-2">Last harvest</p>
            <ReportView report={report} />
          </div>
        )}

        {/* Run history */}
        <AnimatePresence initial={false}>
          {showRuns && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease }}
              className="overflow-hidden"
            >
              <div className="mt-5 space-y-3">
                {runsQ.isPending && <p className="font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>}
                {runsQ.isSuccess && runsQ.data.length === 0 && (
                  <p className="font-mono text-[0.66rem] text-chestnut-soft">No runs recorded yet.</p>
                )}
                {runsQ.data?.map((r) => <ReportView key={r.runId} report={r} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
        'inline-flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] transition-colors disabled:opacity-50',
        danger ? 'text-red-600 hover:text-red-700' : 'text-chestnut hover:text-paprika',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      {label}
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

function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-mono text-[0.56rem] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full',
        enabled ? 'bg-paprika/15 text-paprika-deep' : 'bg-cream-shadow text-chestnut',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-paprika' : 'bg-chestnut-soft'}`} />
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  )
}

function ReportView({ report }: { report: HarvestReport }) {
  return (
    <div className="border border-cream-shadow rounded-xl p-4 bg-cream">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={`font-mono text-[0.58rem] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${statusPill(report.status)}`}>
          {HARVEST_STATUS_LABELS[report.status]}
        </span>
        <span className="font-mono text-[0.64rem] text-chestnut">
          {HARVEST_TRIGGER_LABELS[report.trigger]} · {new Date(report.startedAt).toLocaleString()}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Stat label="discovered" value={report.discovered} />
        <Stat label="inserted" value={report.inserted} tone="green" />
        <Stat label="skipped" value={report.skippedDuplicate} />
        <Stat label="failed" value={report.failed} tone={report.failed > 0 ? 'red' : undefined} />
      </div>

      {report.sources.map((src, i) => {
        const failures = src.items.filter((it) => it.status === 2)
        return (
          <div key={i} className="mt-3 pt-3 border-t border-cream-shadow">
            <p className="font-mono text-[0.64rem] text-chestnut">
              {src.sourceName || src.host}
              {src.error && <span className="text-red-600"> · discovery failed: {src.error}</span>}
            </p>
            {failures.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {failures.map((it, j) => (
                  <li key={j} className="font-mono text-[0.6rem] text-red-600 break-words">
                    {HARVEST_ITEM_STATUS_LABELS[it.status]} · {it.url} — {it.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  const valueColor = tone === 'green' ? 'text-paprika' : tone === 'red' ? 'text-red-600' : 'text-ink'
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-cream-deep px-2.5 py-1">
      <span className={`num text-sm ${valueColor}`}>{value}</span>
      <span className="font-mono text-[0.54rem] uppercase tracking-[0.12em] text-chestnut-soft">{label}</span>
    </span>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────

function SourceForm({
  heading,
  initial,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  heading: string
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
    <div className="rounded-2xl border border-cream-shadow bg-cream-deep p-6 sm:p-7">
      <p className="eyebrow text-paprika mb-5">{heading}</p>

      <div className="grid grid-cols-12 gap-x-6 gap-y-6">
        <label className="col-span-12 sm:col-span-7 block">
          <span className="eyebrow block mb-1.5">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dagelijkse Kost" className={`${field} font-display text-xl`} />
        </label>

        <label className="col-span-12 sm:col-span-5 block">
          <span className="eyebrow block mb-1.5">Domain</span>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="dagelijksekost.vrt.be" className={`${field} font-mono text-sm`} />
          <span className="block font-mono text-[0.6rem] text-chestnut-soft mt-1.5">
            Just the host — recipe pages are found via its sitemap.
          </span>
        </label>

        <label className="col-span-6 sm:col-span-4 block">
          <span className="eyebrow block mb-1.5">Max / run</span>
          <input
            value={maxPerRun}
            onChange={(e) => setMaxPerRun(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="no limit"
            className={`${field} num text-lg`}
          />
          <span className="block font-mono text-[0.6rem] text-chestnut-soft mt-1.5">
            New recipes per run. Empty = no limit.
          </span>
        </label>

        <div className="col-span-6 sm:col-span-8 flex items-start sm:items-end">
          <Toggle label="Enabled" checked={enabled} onChange={setEnabled} />
        </div>
      </div>

      {error != null && (
        <p className="mt-5 font-mono text-[0.7rem] text-red-600">Could not save — check the name and domain, then try again.</p>
      )}

      <div className="flex items-center gap-4 mt-7">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !name.trim() || !host.trim()}
          className="inline-flex items-center rounded-xl px-6 py-2.5 bg-paprika text-cream hover:bg-paprika-deep disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-display font-semibold text-[0.9rem]"
        >
          {submitting ? 'Saving…' : 'Save source'}
        </button>
        <button type="button" onClick={onCancel} className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-chestnut hover:text-paprika transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 group"
    >
      <span
        className={[
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-paprika' : 'bg-cream-shadow',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-cream shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-chestnut group-hover:text-paprika transition-colors">
        {label}
      </span>
    </button>
  )
}
