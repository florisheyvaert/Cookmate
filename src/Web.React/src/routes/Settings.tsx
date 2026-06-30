import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { shoppingApi } from '@/api/shopping'
import { PageHeader } from '@/components/PageHeader'
import { PromotionIntegrations } from '@/components/PromotionIntegrations'
import { RecipeSourcesPanel } from '@/routes/SuggestionSources'
import { useAuth } from '@/auth/AuthContext'
import { useTheme } from '@/components/ThemeProvider'
import type { Theme } from '@/lib/theme'
import { btnPrimary } from '@/lib/ui'

const ease = [0.22, 1, 0.36, 1] as const

// The built-in never-buy ingredients (mirrors Domain/Common/IgnoredIngredients.cs).
const BUILT_IN = ['water', 'heet water', 'warm water', 'koud water', 'lauw water', 'kraanwater', 'kokend water', 'ijs', 'ijsblokjes', 'ijsklontjes']

type Section = {
  id: string
  title: string
  emoji: string
  /** One-line summary shown under the title — and searched. */
  description: string
  /** Extra terms so search finds a section by what it does, not just its title. */
  keywords: string[]
  adminOnly?: boolean
  body: ReactNode
}

export default function Settings() {
  const { isAdmin } = useAuth()
  const [query, setQuery] = useState('')

  // The full registry — each entry carries its own searchable text.
  const sections = useMemo<Section[]>(() => {
    const all: Section[] = [
      {
        id: 'appearance',
        title: 'Appearance',
        emoji: '🎨',
        description: 'Light or dark, or follow your device.',
        keywords: ['theme', 'dark', 'light', 'mode', 'colour', 'color', 'display', 'system'],
        body: <AppearanceSection />,
      },
      {
        id: 'never-buy',
        title: 'Never buy',
        emoji: '🚫',
        description: 'Ingredients always skipped when a cart is built — like tap water.',
        keywords: ['shopping', 'cart', 'ignore', 'exclude', 'ingredient', 'staple', 'water', 'basket'],
        body: <NeverBuySection />,
      },
      {
        id: 'integrations',
        title: 'Integrations',
        emoji: '🔌',
        description: 'Recipe sites for meal ideas, and stores for weekly promotions.',
        keywords: ['sources', 'recipe sites', 'stores', 'promotions', 'bonus', 'albert heijn', 'ah', 'dagelijkse kost', 'harvest', 'schedule', 'scrape', 'dishes'],
        adminOnly: true,
        body: <IntegrationsSection />,
      },
      {
        id: 'members',
        title: 'Members',
        emoji: '👥',
        description: 'Invite people, and promote or remove admins.',
        keywords: ['users', 'people', 'invite', 'admin', 'promote', 'remove', 'accounts', 'access'],
        adminOnly: true,
        body: <MembersSection />,
      },
    ]
    return all.filter((s) => !s.adminOnly || isAdmin)
  }, [isAdmin])

  const q = query.trim().toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)
  const visible = sections.filter((s) => {
    if (terms.length === 0) return true
    const haystack = `${s.title} ${s.description} ${s.keywords.join(' ')}`.toLowerCase()
    return terms.every((t) => haystack.includes(t))
  })

  return (
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-24">
      <PageHeader
        eyebrow="Cookbook · Settings"
        title="Settings"
        subtitle="Make Cookmate yours — appearance, shopping rules, and the sources it cooks from."
      />

      <div className="max-w-3xl">
        <SearchField value={query} onChange={setQuery} resultCount={visible.length} total={sections.length} />

        {visible.length === 0 ? (
          <p className="mt-8 text-ink-soft leading-relaxed">
            No settings match “<span className="text-ink">{query}</span>”. Try another word, or{' '}
            <button type="button" onClick={() => setQuery('')} className="text-paprika hover:underline">clear the search</button>.
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((s, i) => (
                <SectionCard key={s.id} section={s} index={i} highlighted={terms.length > 0} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

function SearchField({
  value,
  onChange,
  resultCount,
  total,
}: {
  value: string
  onChange: (v: string) => void
  resultCount: number
  total: number
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-chestnut-soft pointer-events-none">
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search settings…"
        aria-label="Search settings"
        className="w-full rounded-xl border border-cream-shadow bg-cream-deep pl-11 pr-28 py-3.5 text-ink placeholder:text-chestnut-soft focus:border-paprika focus:outline-none transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-chestnut-soft tabular-nums">
        {value.trim() ? `${resultCount} of ${total}` : `${total} settings`}
      </span>
    </div>
  )
}

function SectionCard({ section, index, highlighted }: { section: Section; index: number; highlighted: boolean }) {
  return (
    <motion.section
      layout
      id={section.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: highlighted ? 0.2 : 0.4, ease, delay: highlighted ? 0 : index * 0.04 }}
      className="scroll-mt-24 rounded-2xl border border-cream-shadow bg-cream-deep p-5 sm:p-7"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-1 h-5 rounded-full bg-paprika" aria-hidden />
        <h2 className="text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>{section.title}</h2>
        <span className="text-lg leading-none" aria-hidden>{section.emoji}</span>
        {section.adminOnly && (
          <span className="ml-auto font-mono text-[0.56rem] uppercase tracking-[0.14em] text-chestnut-soft border border-cream-shadow rounded-full px-2 py-0.5">
            Admin
          </span>
        )}
      </div>
      <p className="text-ink-soft leading-relaxed mb-5">{section.description}</p>
      {section.body}
    </motion.section>
  )
}

// ── Appearance ──────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: Theme; label: string; glyph: string }[] = [
  { value: 'system', label: 'System', glyph: '◐' },
  { value: 'light', label: 'Light', glyph: '☀' },
  { value: 'dark', label: 'Dark', glyph: '☾' },
]

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex flex-wrap gap-1 rounded-xl border border-cream-shadow bg-cream p-1">
      {THEME_OPTIONS.map((o) => {
        const active = theme === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={[
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors',
              active ? 'bg-paprika text-cream' : 'text-chestnut hover:text-paprika',
            ].join(' ')}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            <span aria-hidden className="text-base leading-none">{o.glyph}</span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Never buy ───────────────────────────────────────────────────────────────

function NeverBuySection() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')

  const ignoredQ = useQuery({ queryKey: ['ignored-ingredients'], queryFn: () => shoppingApi.listIgnored() })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ignored-ingredients'] })
  const add = useMutation({ mutationFn: (name: string) => shoppingApi.ignore(name), onSuccess: invalidate })
  const remove = useMutation({ mutationFn: (name: string) => shoppingApi.unignore(name), onSuccess: invalidate })

  const ignored = ignoredQ.data ?? []

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    add.mutate(name, { onSuccess: () => setDraft('') })
  }

  return (
    <>
      <form onSubmit={submit} className="flex items-end gap-3 mb-6">
        <label className="block flex-1">
          <span className="eyebrow block mb-1.5">Add an ingredient</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. heet water"
            className="w-full bg-transparent border-0 border-b-2 border-cream-shadow focus:border-paprika focus:outline-none py-2 text-sm text-ink transition-colors"
          />
        </label>
        <button type="submit" disabled={!draft.trim() || add.isPending} className={btnPrimary + ' shrink-0'}>
          {add.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {ignoredQ.isPending ? (
        <p className="font-mono text-[0.66rem] text-chestnut-soft">Loading…</p>
      ) : ignored.length === 0 ? (
        <p className="font-mono text-[0.66rem] text-chestnut-soft">Nothing added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ignored.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => remove.mutate(name)}
                disabled={remove.isPending}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-cream-shadow text-chestnut hover:border-paprika hover:text-paprika transition-colors text-sm disabled:opacity-50"
                title="Remove"
              >
                {name} <span aria-hidden className="text-base leading-none">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-7 pt-5 border-t border-cream-shadow">
        <p className="eyebrow mb-2.5">Always skipped (built in)</p>
        <ul className="flex flex-wrap gap-1.5">
          {BUILT_IN.map((name) => (
            <li key={name} className="inline-flex items-center rounded-full px-2.5 py-1 bg-cream-shadow/50 text-chestnut-soft font-mono text-[0.62rem]">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

// ── Integrations ────────────────────────────────────────────────────────────

function IntegrationsSection() {
  return (
    <div>
      {/* Recipe sites — user-added sites, harvested into your ideas */}
      <div id="recipe-sites" className="scroll-mt-24">
        <div className="flex items-baseline gap-2.5 mb-1.5">
          <span className="eyebrow text-paprika">Recipe sites · meal ideas</span>
          <span aria-hidden>📖</span>
        </div>
        <p className="text-ink-soft text-sm leading-relaxed mb-4">
          Add any site by its domain — recipe pages are found automatically and harvested into your ideas.
        </p>
        <RecipeSourcesPanel />
      </div>

      {/* Stores — code-defined promotion sources */}
      <div className="mt-10 pt-8 border-t border-cream-shadow">
        <PromotionIntegrations />
      </div>
    </div>
  )
}

// ── Members ─────────────────────────────────────────────────────────────────

function MembersSection() {
  return (
    <Link to="/users" className={btnPrimary + ' no-underline'}>
      Manage members <span aria-hidden>→</span>
    </Link>
  )
}

function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" />
    </svg>
  )
}
