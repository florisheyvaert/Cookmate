import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

/**
 * The house modal shell — cream paper on a blurred ink scrim, a bottom sheet on
 * phones and a centred card on desktop. Handles Escape, body-scroll lock, and a
 * scrollable body with an optional sticky footer, so feature dialogs only supply
 * their content. Matches ConfirmDialog / the product-search sheet.
 */
export function Dialog({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
      )}
      {open && (
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.22, ease }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 pointer-events-none"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`grain w-full ${maxWidth} bg-cream border border-chestnut/25 shadow-[0_28px_70px_-18px_rgba(20,30,18,0.5)] pointer-events-auto rounded-t-3xl sm:rounded-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 flex items-start gap-3 px-6 pt-5 pb-4 border-b border-cream-shadow">
              <div className="min-w-0 flex-1">
                {eyebrow && <p className="eyebrow text-paprika mb-1.5">{eyebrow}</p>}
                <h2 className="font-display text-ink text-xl leading-tight truncate" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 -mr-1 -mt-0.5 grid place-items-center w-8 h-8 rounded-lg text-chestnut hover:text-paprika transition-colors"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer className="shrink-0 px-6 py-4 border-t border-cream-shadow flex items-center justify-end gap-4">
                {footer}
              </footer>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
