import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

export type ConfirmOptions = {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmContextValue = {
  ask: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

type Pending = {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve })
    })
  }, [])

  function close(value: boolean) {
    pending?.resolve(value)
    setPending(null)
  }

  // Focus the confirm button when the dialog opens, and trap Escape to cancel.
  useEffect(() => {
    if (!pending) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Defer focus so it lands after the entry animation begins.
    const t = setTimeout(() => confirmButtonRef.current?.focus(), 60)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        close(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  return (
    <ConfirmContext value={{ ask }}>
      {children}

      <AnimatePresence>
        {pending && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 bg-ink/45 backdrop-blur-sm"
            onClick={() => close(false)}
            aria-hidden
          />
        )}
        {pending && (
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 py-12 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="grain w-full max-w-md bg-cream border border-chestnut/30 shadow-[0_24px_60px_-12px_rgba(26,20,16,0.35)] pointer-events-auto rounded-sm">
              <div className="px-7 pt-7 pb-6">
                <p className="eyebrow mb-3">
                  {pending.options.destructive ? 'Confirm · destructive' : 'Confirm'}
                </p>
                <h2
                  id="confirm-title"
                  className="font-display text-ink text-3xl md:text-4xl mb-3"
                  style={{
                    fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                  }}
                >
                  {pending.options.title}
                </h2>
                {pending.options.body && (
                  <div
                    className="font-display text-ink-soft text-base leading-relaxed"
                    style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                  >
                    {pending.options.body}
                  </div>
                )}
              </div>

              <div className="border-t border-cream-shadow px-7 py-4 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
                >
                  {pending.options.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => close(true)}
                  className={[
                    'inline-flex items-center gap-2 px-5 py-2.5 font-mono uppercase tracking-[0.18em] text-[0.72rem] transition-colors',
                    pending.options.destructive
                      ? 'bg-paprika text-cream hover:bg-paprika-deep'
                      : 'bg-ink text-cream hover:bg-paprika',
                  ].join(' ')}
                >
                  {pending.options.confirmLabel ?? (pending.options.destructive ? 'Delete' : 'Confirm')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
