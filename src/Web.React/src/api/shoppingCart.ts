import { api } from '@/lib/api'

/** 0 Manual · 1 Promotion · 2 MealPlan */
export type CartSource = number

export type CartLine = {
  id: number
  displayName: string
  storeCode: string | null
  sku: string | null
  imageUrl: string | null
  /** Store aisle/category (from the promo it was added from); null for free text / meal-plan lines. */
  category: string | null
  quantity: number
  source: CartSource
  isLinked: boolean
}

export type Cart = {
  items: CartLine[]
  linkedCount: number
}

export type CartDish = {
  suggestionId: number
  title: string
  summary: string | null
  sourceUrl: string
  /** Relative URL of the source site's locally-stored favicon, or null. */
  sourceFaviconUrl: string | null
  baseServings: number
  totalTimeMinutes: number | null
  tags: string[]
  imageUrl: string | null
  matchedIngredientCount: number
  relevantIngredientCount: number
  matchedIngredients: string[]
  missingIngredients: string[]
}

export type AddCartItemInput = {
  displayName: string
  storeCode?: string | null
  sku?: string | null
  imageUrl?: string | null
  category?: string | null
  quantity?: number
  source?: CartSource
}

export const cartApi = {
  get: () => api<Cart>('/api/ShoppingCart'),

  dishes: (limit = 50) => api<CartDish[]>(`/api/ShoppingCart/dishes?limit=${limit}`),

  add: (input: AddCartItemInput) => api<number>('/api/ShoppingCart/items', { method: 'POST', json: input }),

  setQuantity: (id: number, quantity: number) =>
    api<void>(`/api/ShoppingCart/items/${id}/quantity`, { method: 'PUT', json: { quantity } }),

  link: (id: number, body: { storeCode: string; sku: string; productName?: string | null; imageUrl?: string | null }) =>
    api<void>(`/api/ShoppingCart/items/${id}/link`, { method: 'POST', json: body }),

  remove: (id: number) => api<void>(`/api/ShoppingCart/items/${id}`, { method: 'DELETE' }),

  clear: () => api<void>('/api/ShoppingCart', { method: 'DELETE' }),

  addPeriod: (body: { storeCode: string; from: string; to: string }) =>
    api<number>('/api/ShoppingCart/period', { method: 'POST', json: body }),
}
