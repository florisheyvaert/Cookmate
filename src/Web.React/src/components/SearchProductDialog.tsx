import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { shoppingApi } from '@/api/shopping'
import type { GroceryProductCandidateDto } from '@/api/shopping'

const ease = [0.22, 1, 0.36, 1] as const

type SearchProductDialogProps = {
  open: boolean
  storeCode: string
  storeDisplayName: string
  initialQuery: string
  /** External browse-the-store URL shown as a fallback when search comes up empty. */
  browseUrl: string
  onClose: () => void
  /** Called when the user picks a product. The caller persists it. */
  onPick: (candidate: GroceryProductCandidateDto) => void
}

/**
 * Standalone product picker. Lives outside the recipe form so it can be
 * reused later by the multi-recipe shop view too. Always shows a "Browse on
 * the store" link as a fallback for when the unofficial search returns
 * nothing useful — the user is one click from doing it manually and can
 * paste the URL back into the form's paste-URL slot.
 */
export function SearchProductDialog({
  open,
  storeCode,
  storeDisplayName,
  initialQuery,
  browseUrl,
  onClose,
  onPick,
}: SearchProductDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)

  useEffect(() => {
    if (open) setQuery(initialQuery)
  }, [open, initialQuery])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 60)
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
      clearTimeout(t)
    }
  }, [open, onClose])

  const search = useQuery({
    queryKey: ['shop', 'search', storeCode, debounced],
    queryFn: () => shoppingApi.searchProducts(storeCode, debounced),
    staleTime: 60_000,
    enabled: open && debounced.trim().length >= 2,
  })

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
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-product-title"
          >
            <div className="grain w-full max-w-lg bg-cream border border-chestnut/30 shadow-[0_24px_60px_-12px_rgba(26,20,16,0.35)] pointer-events-auto rounded-sm flex flex-col max-h-[85vh]">
              <header className="px-6 pt-6 pb-4 border-b border-cream-shadow">
                <p className="eyebrow mb-2">Find on {storeDisplayName}</p>
                <h2
                  id="search-product-title"
                  className="font-display text-ink text-2xl mb-3"
                  style={{
                    fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 1',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Search the catalogue
                </h2>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${storeDisplayName}…`}
                  className="w-full bg-transparent border-0 border-b-2 border-chestnut/40 focus:border-paprika focus:outline-none py-2 font-mono text-sm text-ink placeholder:text-chestnut-soft transition-colors"
                />
              </header>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {debounced.trim().length < 2 ? (
                  <p className="px-3 py-4 font-mono text-[0.72rem] text-chestnut-soft">
                    Type at least two letters.
                  </p>
                ) : search.isPending ? (
                  <p className="px-3 py-4 font-mono text-[0.72rem] text-chestnut-soft">
                    Searching…
                  </p>
                ) : search.isError ? (
                  <p className="px-3 py-4 font-mono text-[0.72rem] text-paprika-deep">
                    Couldn't reach {storeDisplayName}.
                  </p>
                ) : search.data.length === 0 ? (
                  <p className="px-3 py-4 font-mono text-[0.72rem] text-chestnut-soft">
                    No matches. Use the link below to browse {storeDisplayName} directly.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {search.data.map((p) => (
                      <li key={p.sku}>
                        <button
                          type="button"
                          onClick={() => onPick(p)}
                          className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-paprika-tint rounded-sm transition-colors"
                        >
                          <span className="w-12 h-12 shrink-0 bg-cream-deep/50 border border-cream-shadow rounded-sm overflow-hidden flex items-center justify-center">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <span className="font-mono text-[0.6rem] text-chestnut-soft">no img</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className="block font-display text-ink text-base truncate"
                              style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                            >
                              {p.name}
                            </span>
                            <span className="block font-mono text-[0.66rem] text-chestnut-soft truncate">
                              {[
                                p.brandOrSubtitle,
                                p.packSizeAmount > 0
                                  ? `${formatAmount(p.packSizeAmount)} ${p.packSizeUnit}`
                                  : null,
                                p.unitPrice != null ? `€${p.unitPrice.toFixed(2)}` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="px-6 py-4 border-t border-cream-shadow flex items-center justify-between gap-4 flex-wrap">
                <a
                  href={browseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-paprika hover:text-paprika-deep no-underline"
                >
                  Browse on {storeDisplayName}
                  <span aria-hidden>↗</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
                >
                  Close
                </button>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (n === Math.trunc(n)) return n.toString()
  return n.toFixed(2).replace(/\.?0+$/, '')
}
