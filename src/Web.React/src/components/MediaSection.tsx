import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import type { RecipeMediaDto } from '@/api/types'
import { ApiError } from '@/lib/api'
import { useConfirm } from '@/components/confirm/ConfirmDialog'

const ACCEPTED = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
const ease = [0.22, 1, 0.36, 1] as const

type MediaSectionProps = {
  recipeId: number
  media: RecipeMediaDto[]
}

export function MediaSection({ recipeId, media }: MediaSectionProps) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => recipesApi.uploadMedia(recipeId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipe', recipeId] }),
    onError: (err) => setError(extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (mediaId: number) => recipesApi.removeMedia(recipeId, mediaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipe', recipeId] }),
    onError: (err) => setError(extractError(err)),
  })

  function uploadFiles(files: FileList | File[]) {
    setError(null)
    Array.from(files).forEach((file) => uploadMutation.mutate(file))
  }

  function pickFile() {
    fileInputRef.current?.click()
  }

  async function confirmDelete(id: number) {
    const ok = await confirm.ask({
      title: 'Remove this photo?',
      body: 'It will be removed from this recipe and the underlying file deleted.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (ok) deleteMutation.mutate(id)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
  }

  const cover = media[0] ?? null
  const rest = media.slice(1)
  const isWorking = uploadMutation.isPending

  return (
    <section className="mt-2">
      <header className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
        <p className="eyebrow">
          {cover ? 'Plates' : 'Cover photo'}
          {media.length > 0 && (
            <span className="num text-chestnut-soft ml-2">
              {String(media.length).padStart(2, '0')}
            </span>
          )}
        </p>
        {cover && (
          <button
            type="button"
            onClick={pickFile}
            disabled={isWorking}
            className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline disabled:opacity-60"
          >
            + Add another
          </button>
        )}
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!isDragging) setIsDragging(true)
        }}
        onDragLeave={(e) => {
          // Only clear when leaving the card itself, not entering a child.
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setIsDragging(false)
        }}
        onDrop={handleDrop}
        onClick={cover ? undefined : pickFile}
        onKeyDown={(e) => {
          if (!cover && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            pickFile()
          }
        }}
        role={cover ? undefined : 'button'}
        tabIndex={cover ? undefined : 0}
        aria-label={cover ? undefined : 'Add a cover photo'}
        className={[
          'relative w-full h-[220px] md:h-[260px] overflow-hidden rounded-sm transition-all',
          'border',
          isDragging
            ? 'border-paprika ring-2 ring-paprika/30'
            : cover
              ? 'border-cream-shadow'
              : 'border-dashed border-chestnut/30 hover:border-paprika cursor-pointer',
          cover ? 'bg-ink' : 'bg-cream-deep/40',
        ].join(' ')}
      >
        {cover ? (
          cover.type === 1 ? (
            <img
              src={cover.url}
              alt={cover.caption ?? ''}
              className="w-full h-full object-cover"
            />
          ) : (
            <video src={cover.url} controls className="w-full h-full object-cover" />
          )
        ) : (
          <EmptyCover />
        )}

        {cover && !isDragging && !isWorking && (
          <>
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ink/40 to-transparent pointer-events-none" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                confirmDelete(cover.id)
              }}
              aria-label="Delete cover photo"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-cream/90 text-paprika border border-paprika/40 hover:bg-paprika hover:text-cream transition-colors font-mono text-base"
            >
              ×
            </button>
          </>
        )}

        <AnimatePresence>
          {isDragging && (
            <motion.div
              key="drop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease }}
              className="absolute inset-0 flex items-center justify-center bg-paprika-tint backdrop-blur-sm"
            >
              <p
                className="font-display text-paprika text-3xl md:text-4xl"
                style={{ fontVariationSettings: '"opsz" 96, "SOFT" 80, "WONK" 1', letterSpacing: '-0.02em' }}
              >
                Drop to add
              </p>
            </motion.div>
          )}
          {isWorking && !isDragging && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center bg-cream/70"
            >
              <p className="font-mono text-[0.78rem] uppercase tracking-[0.22em] text-paprika animate-pulse">
                Uploading…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(rest.length > 0 || cover) && (
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <AnimatePresence initial={false}>
            {rest.map((m, i) => (
              <motion.figure
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.04 * i, duration: 0.25, ease }}
                className="relative w-24 h-16 group flex-none"
              >
                {m.type === 1 ? (
                  <img src={m.url} alt="" className="w-full h-full object-cover rounded-sm" />
                ) : (
                  <div className="w-full h-full bg-ink flex items-center justify-center rounded-sm">
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-cream">
                      ▶ video
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => confirmDelete(m.id)}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-cream/90 text-paprika border border-paprika/40 opacity-0 group-hover:opacity-100 hover:bg-paprika hover:text-cream transition-all font-mono text-xs"
                >
                  ×
                </button>
              </motion.figure>
            ))}
          </AnimatePresence>

          {cover && (
            <button
              type="button"
              onClick={pickFile}
              disabled={isWorking}
              aria-label="Add another photo"
              className="w-24 h-16 flex items-center justify-center border border-dashed border-chestnut/30 hover:border-paprika hover:text-paprika text-chestnut-soft transition-colors rounded-sm font-mono text-[0.66rem] uppercase tracking-[0.16em] disabled:opacity-50"
            >
              + add
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="font-mono text-[0.72rem] text-paprika-deep mt-3">{error}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </section>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

function EmptyCover() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <Aperture />
      <p
        className="font-display text-ink text-2xl md:text-3xl mt-4"
        style={{
          fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
          letterSpacing: '-0.02em',
        }}
      >
        Add a cover photo
      </p>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-chestnut mt-2">
        Drop here · click · paste
      </p>
      <p className="font-mono text-[0.6rem] tracking-tight text-chestnut-soft mt-5">
        jpeg · png · webp · mp4 · webm — 50 mb
      </p>
    </div>
  )
}

function Aperture() {
  // A small lens-iris glyph drawn from straight chords — feels more "engraved" than a clip-art camera icon.
  return (
    <svg
      viewBox="0 0 48 48"
      width={42}
      height={42}
      className="text-chestnut"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="24" cy="24" r="18" />
      <path d="M24 6 L33 14" />
      <path d="M42 24 L34 33" />
      <path d="M24 42 L15 34" />
      <path d="M6 24 L14 15" />
      <path d="M37 11 L29 27" />
      <path d="M37 37 L21 29" />
      <path d="M11 37 L19 21" />
      <path d="M11 11 L27 19" />
    </svg>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    return firstError ?? body?.detail ?? `Upload failed (HTTP ${err.status}).`
  }
  return 'Upload failed.'
}
