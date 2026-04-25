import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

type ShareLinkProps = {
  url: string
  title: string
  text?: string
  hint?: string
}

/**
 * Reusable "Share with…" block. Uses the Web Share API when available so the
 * user gets the system share sheet (WhatsApp, Messenger, Mail, …); on browsers
 * without it (most desktop), falls back to a copy-to-clipboard button. The raw
 * link is always shown and selectable as an ultimate fallback.
 */
export function ShareLink({ url, title, text, hint }: ShareLinkProps) {
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'

  async function handleShare() {
    setShareError(null)
    try {
      await navigator.share({ title, text, url })
    } catch (err) {
      // User cancelling counts as AbortError — silent.
      if (err instanceof DOMException && err.name === 'AbortError') return
      setShareError('Could not open the share sheet.')
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShareError('Copy failed — select the link and copy it manually.')
    }
  }

  return (
    <div className="space-y-3">
      {hint && (
        <p className="font-mono text-[0.68rem] text-chestnut-soft leading-relaxed">
          {hint}
        </p>
      )}

      <div className="flex items-center gap-2 px-3 py-2 border border-cream-shadow bg-cream-deep/40 rounded-sm">
        <input
          type="text"
          readOnly
          value={url}
          onClick={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[0.72rem] text-ink truncate"
          aria-label="Redemption link"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-paprika text-cream font-mono uppercase tracking-[0.18em] text-[0.72rem] hover:bg-paprika-deep transition-colors"
          >
            <ShareGlyph />
            Share with…
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className={[
            'inline-flex items-center gap-2 px-5 py-2.5 font-mono uppercase tracking-[0.18em] text-[0.72rem] transition-colors border',
            canShare
              ? 'border-chestnut/40 text-chestnut hover:border-paprika hover:text-paprika'
              : 'bg-paprika text-cream border-paprika hover:bg-paprika-deep',
          ].join(' ')}
        >
          <CopyGlyph />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'copied' : 'copy'}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      {shareError && (
        <p className="font-mono text-[0.7rem] text-paprika-deep">{shareError}</p>
      )}
    </div>
  )
}

function ShareGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8 11 L16 7" />
      <path d="M8 13 L16 17" />
    </svg>
  )
}

function CopyGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5 15 V5 a1.5 1.5 0 0 1 1.5 -1.5 H15" />
    </svg>
  )
}
