import { useCallback, useEffect, useState } from 'react'
import type { CartLine } from '@/api/shoppingCart'

/** How the cart is ordered. "category" groups by store aisle; "az" is one flat A–Z list. */
export type CartSortMode = 'category' | 'az'

const STORAGE_KEY = 'cookmate.cart.sort'
const OTHER = 'Other'

function readStored(): CartSortMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'az' ? 'az' : 'category'
  } catch {
    return 'category'
  }
}

/** Cart sort mode, remembered in localStorage. Defaults to category. */
export function useCartSort(): [CartSortMode, (mode: CartSortMode) => void] {
  const [mode, setMode] = useState<CartSortMode>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore — sort is a convenience, not worth surfacing a storage error */
    }
  }, [mode])

  const set = useCallback((m: CartSortMode) => setMode(m), [])
  return [mode, set]
}

const byName = (a: CartLine, b: CartLine) => a.displayName.localeCompare(b.displayName, 'nl', { sensitivity: 'base' })

/** A flat list sorted A→Z by display name. */
export function sortAZ(lines: CartLine[]): CartLine[] {
  return [...lines].sort(byName)
}

/**
 * Lines grouped by category, each group A→Z, the categories themselves alphabetical with the
 * catch-all "Other" (free text, meal-plan lines) always last.
 */
export function groupByCategory(lines: CartLine[]): { category: string; items: CartLine[] }[] {
  const map = new Map<string, CartLine[]>()
  for (const line of lines) {
    const key = line.category?.trim() || OTHER
    const list = map.get(key)
    if (list) list.push(line)
    else map.set(key, [line])
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === OTHER) return 1
      if (b === OTHER) return -1
      return a.localeCompare(b, 'nl', { sensitivity: 'base' })
    })
    .map(([category, items]) => ({ category, items: items.sort(byName) }))
}
