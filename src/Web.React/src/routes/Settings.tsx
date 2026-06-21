import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { shoppingApi } from '@/api/shopping'
import { PageHeader } from '@/components/PageHeader'
import { btnPrimary } from '@/lib/ui'

const ease = [0.22, 1, 0.36, 1] as const

// The built-in never-buy ingredients (mirrors Domain/Common/IgnoredIngredients.cs).
// Shown read-only so it's clear why e.g. "water" never appears in a cart.
const BUILT_IN = ['water', 'heet water', 'warm water', 'koud water', 'lauw water', 'kraanwater', 'kokend water', 'ijs', 'ijsblokjes', 'ijsklontjes']

export default function Settings() {
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
    <div className="px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-16 pb-24">
      <PageHeader
        eyebrow="Cookbook · Settings"
        title="Settings"
        subtitle="Preferences that shape your shopping carts."
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        className="max-w-xl rounded-2xl border border-cream-shadow bg-cream-deep p-5 sm:p-7"
      >
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-1 h-5 rounded-full bg-paprika" aria-hidden />
          <h2 className="text-ink text-lg" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>Never buy</h2>
          <span className="text-lg leading-none" aria-hidden>🚫</span>
        </div>
        <p className="text-ink-soft leading-relaxed mb-5">
          Ingredients here are skipped when a cart is built — handy for things you'd never put in a basket, like tap water.
        </p>

        {/* Add */}
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

        {/* Your list */}
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

        {/* Built-in */}
        <div className="mt-7 pt-5 border-t border-cream-shadow">
          <p className="eyebrow mb-2.5">Always skipped (built in)</p>
          <ul className="flex flex-wrap gap-1.5">
            {BUILT_IN.map((name) => (
              <li
                key={name}
                className="inline-flex items-center rounded-full px-2.5 py-1 bg-cream-shadow/50 text-chestnut-soft font-mono text-[0.62rem]"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </motion.section>
    </div>
  )
}
