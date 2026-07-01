import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import { cartApi } from '@/api/shoppingCart'
import type { GroceryProductCandidateDto } from '@/api/shopping'
import { ProductSearchDialog } from '@/components/ProductSearchDialog'

// Albert Heijn is the primary (and only online) store; free-text add works
// regardless of which store you search, so a fixed default is fine here.
const STORE_CODE = 'ah'

/**
 * A one-tap "add to cart" for the home screen: opens the exact same product-search
 * sheet the shopping cart uses, drops the pick (or free text) straight into the cart,
 * and flashes a small confirmation so you know it landed — without leaving home.
 */
export function QuickAddProduct({ className }: { className?: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState<string | null>(null)

  const addItem = useMutation({
    mutationFn: cartApi.add,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-cart'] })
      qc.invalidateQueries({ queryKey: ['cart-dishes'] })
    },
  })

  // The confirmation flashes and fades on its own.
  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(null), 2800)
    return () => clearTimeout(t)
  }, [added])

  function addText(text: string) {
    const name = text.trim()
    if (!name) return
    addItem.mutate({ displayName: name })
    setAdded(name)
    setOpen(false)
  }

  function onPick(p: GroceryProductCandidateDto) {
    addItem.mutate({ displayName: p.name, storeCode: STORE_CODE, sku: p.sku, imageUrl: p.imageUrl })
    setAdded(p.name)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'w-full inline-flex items-center justify-center gap-2.5 rounded-2xl bg-paprika text-cream px-5 py-4 font-display font-semibold text-lg hover:bg-paprika-deep transition-colors shadow-[0_10px_30px_-12px_rgba(232,90,26,0.7)]'
        }
      >
        <span aria-hidden className="text-xl leading-none">🛒</span>
        Add to cart
      </button>

      {open && (
        <ProductSearchDialog
          storeCode={STORE_CODE}
          heading="Add a product"
          initialQuery=""
          onAddText={addText}
          onPick={onPick}
          onClose={() => setOpen(false)}
        />
      )}

      <AnimatePresence>
        {added && (
          <motion.div
            key="added-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none"
          >
            <span className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-ink text-cream pl-4 pr-2 py-2 shadow-lg shadow-ink/30">
              <span className="font-display text-sm" style={{ fontWeight: 600 }}>
                <span aria-hidden>✓ </span>Added <span className="text-cream/80">{added}</span>
              </span>
              <Link
                to="/shopping-cart"
                className="rounded-full bg-cream/15 hover:bg-cream/25 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-cream no-underline transition-colors"
              >
                View cart
              </Link>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
