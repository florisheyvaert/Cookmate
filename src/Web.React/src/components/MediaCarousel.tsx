import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import type { RecipeMediaDto } from '@/api/types'
import { ApiError } from '@/lib/api'
import { useConfirm } from '@/components/confirm/ConfirmDialog'

const ACCEPTED = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
const ease = [0.22, 1, 0.36, 1] as const

type Source = 'file' | 'camera-back' | 'camera-front'

type MediaCarouselProps = {
  recipeId: number
  media: RecipeMediaDto[]
}

export function MediaCarousel({ recipeId, media }: MediaCarouselProps) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraBackRef = useRef<HTMLInputElement>(null)
  const cameraFrontRef = useRef<HTMLInputElement>(null)
  const tileButtonRef = useRef<HTMLButtonElement>(null)

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

  async function confirmDelete(id: number) {
    const ok = await confirm.ask({
      title: 'Remove this photo?',
      body: 'It will be removed from this recipe and the underlying file deleted.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (ok) deleteMutation.mutate(id)
  }

  function trigger(source: Source) {
    setPickerOpen(false)
    if (source === 'file') fileRef.current?.click()
    else if (source === 'camera-back') cameraBackRef.current?.click()
    else if (source === 'camera-front') cameraFrontRef.current?.click()
  }

  // Close picker on outside click / Escape.
  useEffect(() => {
    if (!pickerOpen) return
    function onClick(e: MouseEvent) {
      if (!tileButtonRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  const isWorking = uploadMutation.isPending

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
            ref={tileButtonRef}
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={isWorking}
            aria-haspopup="menu"
            aria-expanded={pickerOpen}
            className="w-full h-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-chestnut/40 hover:border-paprika hover:bg-paprika-tint text-chestnut hover:text-paprika transition-colors rounded-sm disabled:opacity-50"
          >
            <PlusGlyph />
            <span className="font-display text-2xl text-ink" style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1' }}>
              {isWorking ? 'Uploading…' : 'Add photo'}
            </span>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-chestnut-soft">
              {isWorking ? '' : 'choose · capture'}
            </span>
          </button>

          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18, ease }}
                role="menu"
                className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+0.5rem)] w-[18rem] bg-cream border border-chestnut/30 shadow-[0_24px_60px_-12px_rgba(26,20,16,0.35)] z-20"
              >
                <PickerOption
                  label="Choose from device"
                  hint="Image or video file"
                  onClick={() => trigger('file')}
                />
                <PickerOption
                  label="Camera · back"
                  hint="Snap with the rear camera"
                  onClick={() => trigger('camera-back')}
                />
                <PickerOption
                  label="Camera · front"
                  hint="Snap a selfie"
                  onClick={() => trigger('camera-front')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <p className="px-6 md:px-12 lg:px-20 mt-3 font-mono text-[0.72rem] text-paprika-deep">
          {error}
        </p>
      )}

      {/* Hidden inputs — three of them so capture intent is fixed before file dialog opens */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={cameraBackRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={cameraFrontRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </section>
  )
}

function PickerOption({
  label,
  hint,
  onClick,
}: {
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="w-full text-left px-5 py-3 border-b border-cream-shadow last:border-b-0 hover:bg-paprika-tint transition-colors"
    >
      <p className="font-display text-ink text-base" style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}>
        {label}
      </p>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-chestnut-soft mt-0.5">
        {hint}
      </p>
    </button>
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
    return firstError ?? body?.detail ?? `Upload failed (HTTP ${err.status}).`
  }
  return 'Upload failed.'
}
