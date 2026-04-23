import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import type { RecipeMediaDto } from '@/api/types'
import { ApiError } from '@/lib/api'
import { useConfirm } from '@/components/confirm/ConfirmDialog'
import { AddPhotoDialog } from '@/components/AddPhotoDialog'

const ease = [0.22, 1, 0.36, 1] as const

type MediaCarouselProps = {
  recipeId: number
  media: RecipeMediaDto[]
}

export function MediaCarousel({ recipeId, media }: MediaCarouselProps) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: (mediaId: number) => recipesApi.removeMedia(recipeId, mediaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipe', recipeId] }),
    onError: (err) => setError(extractError(err)),
  })

  async function confirmDelete(id: number) {
    const ok = await confirm.ask({
      title: 'Remove this photo?',
      body: 'It will be removed from this recipe and the underlying file deleted.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (ok) deleteMutation.mutate(id)
  }

  return (
    <section className="mt-12">
      <div
        className="no-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth px-6 md:px-12 lg:px-20 pb-2"
        style={{ scrollPaddingInline: 'var(--scroll-pad, 1.5rem)' }}
      >
        {media.map((m, i) => (
          <motion.figure
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.35, ease }}
            className="group relative snap-start shrink-0 w-[78vw] sm:w-[58vw] md:w-[44vw] lg:w-[32vw] aspect-[4/3] bg-ink rounded-sm overflow-hidden"
          >
            {m.type === 1 ? (
              <img
                src={m.url}
                alt={m.caption ?? ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <video src={m.url} controls className="w-full h-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => confirmDelete(m.id)}
              aria-label="Remove photo"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-cream/90 text-paprika border border-paprika/40 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-paprika hover:text-cream transition-all font-mono"
            >
              ×
            </button>
            {m.caption && (
              <figcaption className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-ink/80 to-transparent">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-cream">
                  {m.caption}
                </span>
              </figcaption>
            )}
          </motion.figure>
        ))}

        <div className="relative snap-start shrink-0 w-[78vw] sm:w-[58vw] md:w-[44vw] lg:w-[32vw] aspect-[4/3]">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="w-full h-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-chestnut/40 hover:border-paprika hover:bg-paprika-tint text-chestnut hover:text-paprika transition-colors rounded-sm"
          >
            <PlusGlyph />
            <span
              className="font-display text-2xl text-ink"
              style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1' }}
            >
              Add photo
            </span>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-chestnut-soft">
              file · camera · URL
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-6 md:px-12 lg:px-20 mt-3 font-mono text-[0.72rem] text-paprika-deep"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <AddPhotoDialog
        recipeId={recipeId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </section>
  )
}

function PlusGlyph() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5 v14" />
      <path d="M5 12 h14" />
    </svg>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    return firstError ?? body?.detail ?? `Request failed (HTTP ${err.status}).`
  }
  return 'Request failed.'
}
