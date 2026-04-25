import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { recipesApi } from '@/api/recipes'
import { ApiError } from '@/lib/api'

const ACCEPTED = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
const ease = [0.22, 1, 0.36, 1] as const

type AddPhotoDialogProps = {
  recipeId: number
  open: boolean
  onClose: () => void
}

export function AddPhotoDialog({ recipeId, open, onClose }: AddPhotoDialogProps) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'menu' | 'url'>('menu')
  const hasCamera = useHasCamera()

  const uploadMutation = useMutation({
    mutationFn: (file: File) => recipesApi.uploadMedia(recipeId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe', recipeId] })
      close()
    },
    onError: (err) => setError(extractError(err)),
  })

  const importMutation = useMutation({
    mutationFn: (input: string) => recipesApi.importMediaFromUrl(recipeId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe', recipeId] })
      close()
    },
    onError: (err) => setError(extractError(err)),
  })

  function close() {
    setUrl('')
    setError(null)
    setMode('menu')
    onClose()
  }

  function uploadFiles(files: FileList | File[]) {
    setError(null)
    Array.from(files).forEach((file) => uploadMutation.mutate(file))
  }

  function submitUrl() {
    const trimmed = url.trim()
    if (!trimmed) return
    setError(null)
    importMutation.mutate(trimmed)
  }

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isWorking) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (mode === 'url') {
      const t = setTimeout(() => urlInputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [mode])

  const isWorking = uploadMutation.isPending || importMutation.isPending

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm"
            onClick={() => !isWorking && close()}
            aria-hidden
          />
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-photo-title"
          >
            <div className="grain w-full max-w-lg bg-cream border border-chestnut/30 shadow-[0_24px_60px_-12px_rgba(26,20,16,0.35)] pointer-events-auto rounded-sm">
              <div className="px-7 pt-7 pb-6">
                <p className="eyebrow mb-3">Add a photo</p>
                <h2
                  id="add-photo-title"
                  className="font-display text-ink text-3xl md:text-4xl mb-5"
                  style={{
                    fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                  }}
                >
                  How shall we add it?
                </h2>

                {mode === 'menu' && (
                  <div className="flex flex-col gap-2">
                    <ChoiceButton
                      label="Choose from device"
                      hint="Pick an image or video file"
                      disabled={isWorking}
                      onClick={() => fileRef.current?.click()}
                    />
                    {hasCamera && (
                      <ChoiceButton
                        label="Take a photo"
                        hint="Open the camera and snap"
                        disabled={isWorking}
                        onClick={() => cameraRef.current?.click()}
                      />
                    )}
                    <ChoiceButton
                      label="Download from URL"
                      hint="Paste a link to an image on the web"
                      disabled={isWorking}
                      onClick={() => setMode('url')}
                    />
                  </div>
                )}

                {mode === 'url' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      submitUrl()
                    }}
                    className="flex flex-col gap-3"
                  >
                    <label className="block">
                      <span className="sr-only">Image URL</span>
                      <input
                        ref={urlInputRef}
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://…/photo.jpg"
                        disabled={isWorking}
                        className="w-full bg-transparent border-0 border-b-2 border-chestnut/40 focus:border-paprika focus:outline-none py-2 font-mono text-base text-ink placeholder:text-chestnut-soft transition-colors disabled:opacity-60"
                      />
                    </label>
                    <p className="font-mono text-[0.68rem] text-chestnut-soft leading-relaxed">
                      We'll download the image to your storage — jpeg, png, or webp, up to 50 MB.
                    </p>
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('menu')
                          setUrl('')
                          setError(null)
                        }}
                        disabled={isWorking}
                        className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors disabled:opacity-60"
                      >
                        ← back
                      </button>
                      <button
                        type="submit"
                        disabled={isWorking || !url.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-paprika text-cream font-mono uppercase tracking-[0.18em] text-[0.72rem] hover:bg-paprika-deep transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {importMutation.isPending ? 'Downloading…' : 'Download'}
                        <span aria-hidden>→</span>
                      </button>
                    </div>
                  </form>
                )}

                {uploadMutation.isPending && (
                  <p className="mt-4 font-mono text-[0.72rem] uppercase tracking-[0.22em] text-paprika animate-pulse">
                    Uploading…
                  </p>
                )}

                {error && (
                  <p className="mt-4 font-mono text-[0.72rem] text-paprika-deep leading-relaxed">
                    {error}
                  </p>
                )}
              </div>

              <div className="border-t border-cream-shadow px-7 py-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={close}
                  disabled={isWorking}
                  className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) uploadFiles(e.target.files)
                e.target.value = ''
              }}
            />
            {hasCamera && (
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) uploadFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ChoiceButton({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group text-left px-5 py-4 border border-cream-shadow hover:border-paprika hover:bg-paprika-tint transition-colors rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <p
        className="font-display text-ink text-xl group-hover:text-paprika transition-colors"
        style={{ fontVariationSettings: '"opsz" 48, "SOFT" 50, "WONK" 0' }}
      >
        {label}
      </p>
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut-soft mt-1">
        {hint}
      </p>
    </button>
  )
}

// `capture` on a file input only does something useful on devices with a
// camera the browser can drive — phones and tablets. `pointer: coarse`
// (touch-primary input) is a close-enough proxy and avoids UA sniffing.
function useHasCamera(): boolean {
  const [hasCamera, setHasCamera] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setHasCamera(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return hasCamera
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    if (firstError) return firstError
    if (err.status === 500) return "Couldn't download from that URL. It must be a direct link to a jpeg, png, or webp image."
    return body?.detail ?? `Failed (HTTP ${err.status}).`
  }
  return 'Something went wrong.'
}
