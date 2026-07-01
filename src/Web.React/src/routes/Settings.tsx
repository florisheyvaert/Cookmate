import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { shoppingApi } from '@/api/shopping'
import { PageHeader } from '@/components/PageHeader'
import { PromotionIntegrations } from '@/components/PromotionIntegrations'
import { RecipeSourcesPanel } from '@/routes/SuggestionSources'
import { MembersPanel } from '@/routes/Users'
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
  /** One-line summary shown when the section is open — and always searched. */
  description: string
  /** Extra terms so search finds a section by what it does, not just its title. */
  keywords: string[]
  adminOnly?: boolean
  body: ReactNode
}

export default function Settings() {
  const { isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

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

  // Deep link: ?section=<id> opens just that section, collapses the rest, and scrolls it into
  // view. Used e.g. from Ideas → "Manage sources" (?section=integrations).
  const sectionParam = searchParams.get('section')
  const linkedSection = sectionParam && sections.some((s) => s.id === sectionParam) ? sectionParam : null

  // Open the linked section the first time it appears — done during render (the React-recommended
  // way) rather than in an effect, so it doesn't fight the user's own toggles.
  const [appliedSection, setAppliedSection] = useState<string | null>(null)
  if (linkedSection && linkedSection !== appliedSection) {
    setAppliedSection(linkedSection)
    setOpenIds(new Set([linkedSection]))
  }

  // Scrolling is a genuine side effect, so it stays in an effect.
  useEffect(() => {
    if (!linkedSection) return
    // After the route's scroll-to-top and this render settle, bring the section into view.
    const t = setTimeout(() => {
      document.getElementById(linkedSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 140)
    return () => clearTimeout(t)
  }, [linkedSection])

  const q = query.trim().toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)
  const searching = terms.length > 0
  const visible = sections.filter((s) => {
    if (!searching) return true
    const haystack = `${s.title} ${s.description} ${s.keywords.join(' ')}`.toLowerCase()
    return terms.every((t) => haystack.includes(t))
  })

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-8 pt-14 md:pt-16 pb-24">
      <PageHeader
        eyebrow="Cookbook · Settings"
        title="Settings"
        subtitle="Make Cookmate yours — appearance, shopping rules, and the sources it cooks from."
      />

      <SearchField value={query} onChange={setQuery} resultCount={visible.length} total={sections.length} />

        {visible.length === 0 ? (
          <p className="mt-8 text-ink-soft leading-relaxed">
            No settings match “<span className="text-ink">{query}</span>”. Try another word, or{' '}
            <button type="button" onClick={() => setQuery('')} className="text-paprika hover:underline">clear the search</button>.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {visible.map((s) => (
              // While searching, matching sections open so their content is visible.
              <SectionCard key={s.id} section={s} terms={terms} open={searching || openIds.has(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </div>
        )}
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
        className="w-full rounded-xl border border-cream-shadow bg-cream-deep pl-11 pr-24 py-3.5 text-ink placeholder:text-chestnut-soft focus:border-paprika focus:outline-none transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[0.58rem] sm:text-[0.6rem] uppercase tracking-[0.12em] text-chestnut-soft tabular-nums">
        {value.trim() ? `${resultCount}/${total}` : `${total} settings`}
      </span>
    </div>
  )
}

function SectionCard({ section, terms, open, onToggle }: { section: Section; terms: string[]; open: boolean; onToggle: () => void }) {
  // Let inner dropdowns (schedule day/time pickers) escape the card once the open
  // animation has settled; clip during the height transition.
  const [animating, setAnimating] = useState(false)

  return (
    <section
      id={section.id}
      className={`scroll-mt-24 rounded-2xl border border-cream-shadow bg-cream-deep ${open && !animating ? 'overflow-visible' : 'overflow-hidden'}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 sm:px-7 py-4 sm:py-5 text-left hover:bg-cream/30 transition-colors"
      >
        <span className="w-1 h-5 rounded-full bg-paprika shrink-0" aria-hidden />
        <h2 className="text-ink text-base sm:text-lg min-w-0 truncate" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>
          <Highlight text={section.title} terms={terms} />
        </h2>
        <span className="text-base sm:text-lg leading-none shrink-0" aria-hidden>{section.emoji}</span>
        <span className="ml-auto flex items-center gap-2.5 sm:gap-3 shrink-0">
          {section.adminOnly && (
            <span className="hidden sm:inline font-mono text-[0.56rem] uppercase tracking-[0.14em] text-chestnut-soft border border-cream-shadow rounded-full px-2 py-0.5">
              Admin
            </span>
          )}
          <span className="text-chestnut-soft"><Chevron open={open} /></span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease }}
            onAnimationStart={() => setAnimating(true)}
            onAnimationComplete={() => setAnimating(false)}
            className={animating ? 'overflow-hidden' : 'overflow-visible'}
          >
            <div className="px-4 sm:px-7 pb-5 sm:pb-7 pt-1">
              <p className="text-ink-soft leading-relaxed mb-5">
                <Highlight text={section.description} terms={terms} />
              </p>
              {section.body}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Wraps every occurrence of a search term in the text with a paprika highlight. Case-insensitive,
// keeps the original casing on screen. Longer terms first so they win over shorter overlaps.
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>
  const pattern = terms.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')
  const isHit = new RegExp(`^(?:${pattern})$`, 'i')
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part && isHit.test(part) ? (
          <mark key={i} className="rounded-[0.2em] bg-yellow-300 text-ink px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
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
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-3 gap-1 w-full sm:inline-flex sm:w-auto rounded-xl border border-cream-shadow bg-cream p-1"
    >
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
              'inline-flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2.5 sm:py-2 text-sm transition-colors',
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
      {/* Stack on mobile so the input isn't squeezed next to the button. */}
      <form onSubmit={submit} className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
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
        <button type="submit" disabled={!draft.trim() || add.isPending} className={btnPrimary + ' w-full sm:w-auto shrink-0'}>
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
  // Two clearly-titled groups (recipe sources, then store promotions), each a flat
  // list rather than a stack of bordered cards. Separated by a single hairline so
  // they read as distinct without nesting box-in-box.
  return (
    <div className="divide-y divide-cream-shadow [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
      <RecipeSourcesPanel />
      <PromotionIntegrations />
    </div>
  )
}

// ── Members ─────────────────────────────────────────────────────────────────

function MembersSection() {
  return <MembersPanel />
}

function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" />
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 10 10" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
