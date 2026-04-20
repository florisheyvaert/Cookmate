import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import { ApiError } from '@/lib/api'

const ease = [0.22, 1, 0.36, 1] as const

export function ImportFromUrlPanel() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (input: string) => recipesApi.importFromUrl(input),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ['recipes'] })
      navigate(`/recipes/${id}/edit`, { replace: true })
    },
    onError: (err) => setError(extractError(err)),
  })

  function submit() {
    if (!url.trim()) return
    setError(null)
    mutation.mutate(url.trim())
  }

  return (
    <section className="px-6 md:px-12 lg:px-20 pt-2 pb-2">
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="grain relative overflow-hidden border border-cream-shadow rounded-sm bg-cream-deep/30 px-6 md:px-10 py-8 md:py-12"
      >
        {/* Decorative glyph echoing the empty-cover one — keeps the cookbook visual language. */}
        <span
          aria-hidden
          className="absolute -right-6 -bottom-12 select-none text-paprika/15 leading-none pointer-events-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(10rem, 22vw, 22rem)',
            fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
            letterSpacing: '-0.05em',
          }}
        >
          ❦
        </span>

        <p className="eyebrow mb-3">Import from URL</p>

        <h2
          className="font-display text-ink mb-6 max-w-3xl"
          style={{
            fontSize: 'clamp(1.8rem, 4.5vw, 3.2rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
          }}
        >
          Drop a link from anywhere on the web.
        </h2>

        <div className="relative max-w-3xl flex items-end gap-4 flex-wrap">
          <label className="flex-1 min-w-[16rem]">
            <span className="sr-only">Recipe URL</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://dagelijksekost.vrt.be/gerechten/…"
              disabled={mutation.isPending}
              autoFocus
              className="w-full bg-transparent border-0 border-b-2 border-chestnut/40 focus:border-paprika focus:outline-none py-2 font-mono text-base text-ink placeholder:text-chestnut-soft transition-colors disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending || !url.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-paprika text-cream font-mono uppercase tracking-[0.18em] text-[0.78rem] hover:bg-paprika-deep transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Importing…' : 'Import'}
            <span aria-hidden>→</span>
          </button>
        </div>

        <div className="relative mt-5 max-w-3xl min-h-[1.5rem]">
          {error ? (
            <p className="font-mono text-[0.72rem] text-paprika-deep leading-relaxed">{error}</p>
          ) : mutation.isPending ? (
            <p className="font-mono text-[0.72rem] text-chestnut leading-relaxed">
              Fetching the page, parsing the recipe, downloading the photo…
            </p>
          ) : (
            <p className="font-mono text-[0.68rem] text-chestnut-soft">
              Saves a draft and opens the edit form. Works with sites that publish
              schema.org Recipe metadata — Dagelijkse Kost, AH Allerhande, most cooking blogs.
            </p>
          )}
        </div>
      </motion.form>

      {/* Subtle divider into the blank-form path */}
      <div className="flex items-center gap-6 my-10 max-w-3xl mx-auto" aria-hidden>
        <span className="flex-1 h-px bg-cream-shadow" />
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-chestnut-soft">
          or write your own ↓
        </span>
        <span className="flex-1 h-px bg-cream-shadow" />
      </div>
    </section>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    if (firstError) return firstError
    if (err.status === 500) return "Couldn't read a recipe from that page. Either the site doesn't expose structured data or the URL is wrong."
    return body?.detail ?? `Import failed (HTTP ${err.status}).`
  }
  return 'Import failed.'
}
