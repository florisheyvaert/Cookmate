import type { CartSortMode } from '@/lib/cartSort'

/** Segmented Category / A–Z control for ordering the cart. */
export function CartSortToggle({
  mode,
  onChange,
  size = 'md',
}: {
  mode: CartSortMode
  onChange: (mode: CartSortMode) => void
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5'
  return (
    <div
      role="group"
      aria-label="Sort the cart"
      className="inline-flex items-center rounded-lg border border-cream-shadow bg-cream p-0.5"
    >
      {(['category', 'az'] as const).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            className={[
              pad,
              'rounded-md font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-colors',
              active ? 'bg-paprika text-cream' : 'text-chestnut hover:text-paprika',
            ].join(' ')}
          >
            {m === 'category' ? 'Category' : 'A–Z'}
          </button>
        )
      })}
    </div>
  )
}
