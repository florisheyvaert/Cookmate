import { api } from '@/lib/api'

export type PromotionDto = {
  sku: string
  name: string
  brandOrSubtitle: string | null
  imageUrl: string | null
  packSize: string | null
  originalPrice: number | null
  promoPrice: number | null
  discountLabel: string | null
  currency: string | null
  /** ISO date yyyy-MM-dd, or null. */
  validFrom: string | null
  validTo: string | null
}

export type PromoUsage = {
  sku: string
  name: string
  discountLabel: string | null
  /** True = remembered link, false = best-effort match the user can confirm. */
  confirmed: boolean
  /** True for single products (confirmable); false for combi-group tiles (name match only). */
  linkable: boolean
  /** The dish ingredient this promo matched — used when confirming. */
  ingredientName: string
}

export type PromoPeriod = {
  /** ISO date yyyy-MM-dd, or null. */
  validFrom: string | null
  validTo: string | null
  count: number
  isCurrent: boolean
}

export type PromoDish = {
  suggestionId: number
  title: string
  summary: string | null
  sourceUrl: string
  baseServings: number
  totalTimeMinutes: number | null
  tags: string[]
  imageUrl: string | null
  matchedIngredientCount: number
  relevantIngredientCount: number
  usedPromos: PromoUsage[]
}

export const promotionsApi = {
  /** The cached bonus weeks for a store (oldest first), for the week filter. */
  periods: (storeCode: string) =>
    api<PromoPeriod[]>(`/api/Promotions/${encodeURIComponent(storeCode)}/periods`),

  list: (storeCode: string, validFrom?: string | null) => {
    const qs = validFrom ? `?validFrom=${encodeURIComponent(validFrom)}` : ''
    return api<PromotionDto[]>(`/api/Promotions/${encodeURIComponent(storeCode)}${qs}`)
  },

  dishes: (storeCode: string, skus: string[], validFrom?: string | null, limit = 24) => {
    const qs = new URLSearchParams()
    for (const sku of skus) qs.append('skus', sku)
    if (validFrom) qs.set('validFrom', validFrom)
    qs.set('limit', String(limit))
    return api<PromoDish[]>(`/api/Promotions/${encodeURIComponent(storeCode)}/dishes?${qs.toString()}`)
  },

  /** Admin-only: pull the store's current bonus assortment into the cache. Returns the count. */
  refresh: (storeCode: string) =>
    api<number>(`/api/Promotions/refresh/${encodeURIComponent(storeCode)}`, { method: 'POST', json: {} }),

  /** Confirm that an ingredient name maps to a promo product (remembered for the cart). */
  confirmMatch: (storeCode: string, ingredientName: string, sku: string) =>
    api<void>('/api/Promotions/match/confirm', {
      method: 'POST',
      json: { storeCode, ingredientName, sku, defaultPackQuantity: 1 },
    }),
}
