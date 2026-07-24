import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { shoppingApi, type GroceryProductCandidateDto } from '@/api/shopping'

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

/**
 * The store product-search sheet: type a name, pick a real store product, or
 * (in add mode) drop in whatever you typed as free text. Pure UI — the caller
 * owns what "pick" and "add text" actually do (add to cart, link a line, …), so
 * the shopping cart and the home quick-add both reuse the exact same dialog.
 */
export function ProductSearchDialog({
  storeCode,
  heading,
  initialQuery,
  onAddText,
  onPick,
  onClose,
}: {
  storeCode: string
  heading: string
  /** Seeds the search box. Mounted fresh per open. */
  initialQuery: string
  /** When set (add mode), the first row lets you add whatever you typed as free text. */
  onAddText?: (text: string) => void
  onPick: (p: GroceryProductCandidateDto) => void
  onClose: () => void
}) {
  const [q, setQ] = useState(initialQuery)
  const trimmed = q.trim()
  const searchQ = useQuery({
    queryKey: ['product-search', storeCode, q],
    queryFn: () => shoppingApi.searchProducts(storeCode, q),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  })
  const results = searchQ.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl h-[85vh] sm:h-[600px] sm:max-h-[85vh] flex flex-col bg-cream rounded-t-3xl sm:rounded-2xl border border-cream-shadow overflow-hidden shadow-2xl shadow-ink/25"
      >
        <header className="shrink-0 px-5 sm:px-6 py-4 sm:py-5 border-b border-cream-shadow">
          <p className="eyebrow text-paprika mb-2.5">{heading}</p>
          <div className="flex items-center gap-2.5 border-b-2 border-cream-shadow focus-within:border-paprika transition-colors">
            <span aria-hidden className="text-chestnut-soft text-lg leading-none">🔍</span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-transparent border-0 focus:outline-none py-2 text-ink text-lg"
            />
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {/* Free-text add — always the first option, so you can add anything you type. */}
          {onAddText && trimmed.length > 0 && (
            <button
              type="button"
              onClick={() => onAddText(trimmed)}
              className="w-full flex items-center gap-3 rounded-2xl border border-paprika/40 bg-paprika/8 px-4 py-3 text-left hover:bg-paprika/15 transition-colors"
            >
              <span className="shrink-0 w-9 h-9 rounded-full bg-paprika text-cream grid place-items-center text-lg leading-none">+</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-ink leading-tight" style={{ fontWeight: 600 }}>
                  Add “<span className="text-paprika-deep">{trimmed}</span>” to your cart
                </span>
                <span className="block font-mono text-[0.54rem] uppercase tracking-[0.12em] text-chestnut-soft mt-0.5">as free text</span>
              </span>
            </button>
          )}

          {trimmed.length < 2 ? (
            <p className="px-2 py-8 text-center font-mono text-[0.66rem] text-chestnut-soft">
              {onAddText ? 'Type a product name — or add whatever you type as free text.' : 'Type at least 2 letters.'}
            </p>
          ) : searchQ.isPending ? (
            <p className="px-2 py-8 text-center font-mono text-[0.66rem] text-chestnut-soft">Searching products…</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-8 text-center font-mono text-[0.66rem] text-chestnut-soft">No matching products.</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {results.map((p) => (
                <li key={p.sku}>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className="group w-full h-full flex flex-col text-left rounded-2xl border border-cream-shadow bg-cream overflow-hidden hover:border-paprika/60 transition-colors"
                  >
                    <span className="relative aspect-square bg-cream-deep grid place-items-center overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <span aria-hidden className="text-3xl opacity-30">🛒</span>
                      )}
                      <span
                        aria-hidden
                        className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-paprika text-cream grid place-items-center text-lg leading-none shadow-md opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
                      >
                        +
                      </span>
                    </span>
                    <span className="flex-1 flex flex-col gap-1 p-3">
                      <span className="font-display text-ink leading-tight line-clamp-2" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {p.name}
                      </span>
                      {p.packSizeUnit && (
                        <span className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-chestnut-soft">
                          {p.packSizeAmount > 0 ? `${p.packSizeAmount} ` : ''}
                          {p.packSizeUnit}
                        </span>
                      )}
                      {p.unitPrice != null && <span className="num text-paprika text-base mt-auto pt-1">{euro.format(p.unitPrice)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="shrink-0 px-5 py-3 border-t border-cream-shadow text-right">
          <button type="button" onClick={onClose} className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut hover:text-paprika transition-colors">Close</button>
        </footer>
      </motion.div>
    </div>
  )
}
