import { api } from '@/lib/api'
import type { HarvestReport, HarvestSchedule } from '@/api/suggestions'

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
  /** The dish ingredient this promo matched — used when confirming. */
  ingredientName: string
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

/** A store Cookmate can pull promotions from, with its toggle + last-refresh telemetry. */
export type PromotionIntegration = {
  storeCode: string
  displayName: string
  enabled: boolean
  lastRunAt: string | null
  /** 0 Succeeded · 1 Partial · 2 Failed · 3 Processing (shared with harvest). */
  lastRunStatus: number | null
  lastRunCount: number | null
  /** How many promotions are currently cached for this store. */
  promotionCount: number
}

export const promotionsApi = {
  list: (storeCode: string) =>
    api<PromotionDto[]>(`/api/Promotions/${encodeURIComponent(storeCode)}`),

  dishes: (storeCode: string, skus: string[], limit = 24) => {
    const qs = new URLSearchParams()
    for (const sku of skus) qs.append('skus', sku)
    qs.set('limit', String(limit))
    return api<PromoDish[]>(`/api/Promotions/${encodeURIComponent(storeCode)}/dishes?${qs.toString()}`)
  },

  /** Admin-only: pull one store's current bonus assortment into the cache, recording a run. */
  refresh: (storeCode: string) =>
    api<HarvestReport>(`/api/Promotions/refresh/${encodeURIComponent(storeCode)}`, { method: 'POST', json: {} }),

  /** Confirm that an ingredient name maps to a promo product (remembered for the cart). */
  confirmMatch: (storeCode: string, ingredientName: string, sku: string) =>
    api<void>('/api/Promotions/match/confirm', {
      method: 'POST',
      json: { storeCode, ingredientName, sku, defaultPackQuantity: 1 },
    }),

  // ── Integrations management (admin) ──────────────────────────────────────────
  integrations: {
    list: () => api<PromotionIntegration[]>('/api/Promotions/integrations'),

    /** Switch a store's promotions capability on or off. */
    setEnabled: (storeCode: string, enabled: boolean) =>
      api<void>(`/api/Promotions/integrations/${encodeURIComponent(storeCode)}`, {
        method: 'PUT',
        json: { enabled },
      }),

    /** Run the refresh for every enabled store now. */
    refreshAll: () => api<HarvestReport>('/api/Promotions/refresh', { method: 'POST', json: {} }),

    runs: (take = 20) => api<HarvestReport[]>(`/api/Promotions/runs?take=${take}`),
  },

  schedule: {
    get: () => api<HarvestSchedule>('/api/Promotions/schedule'),
    update: (input: HarvestSchedule) =>
      api<void>('/api/Promotions/schedule', { method: 'PUT', json: input }),
  },
}
