import { api } from '@/lib/api'

export type GroceryStoreDto = {
  code: string
  displayName: string
}

export type GroceryProductCandidateDto = {
  sku: string
  name: string
  brandOrSubtitle: string | null
  packSizeAmount: number
  packSizeUnit: string
  unitPrice: number | null
  currency: string | null
  imageUrl: string | null
  canonicalUrl: string | null
}

export type MappedShoppingItemDto = {
  ingredientId: number
  recipeId: number
  ingredientName: string
  sku: string
  productName: string
  imageUrl: string | null
  packs: number
  packSizeAmount: number
  packSizeUnit: string
}

export type UnmappedShoppingItemDto = {
  ingredientId: number
  recipeId: number
  name: string
  amount: number
  unit: string
}

export type ShoppingDeeplinkResultDto = {
  deeplink: string | null
  storeCode: string
  storeDisplayName: string
  mapped: MappedShoppingItemDto[]
  unmapped: UnmappedShoppingItemDto[]
  truncated: boolean
}

export type LinkIngredientInput = {
  ingredientId: number
  storeCode: string
  sku: string
  defaultPackQuantity: number
}

export type LinkIngredientByUrlInput = {
  ingredientId: number
  storeCode: string
  productUrl: string
  defaultPackQuantity: number
}

export type DeeplinkItem = { sku: string; quantity: number }

export type CartDeeplinkDto = {
  deeplink: string | null
  truncated: boolean
  storeCode: string
  storeDisplayName: string
}

export const shoppingApi = {
  listStores: () => api<GroceryStoreDto[]>('/api/Shopping/stores'),

  searchProducts: (storeCode: string, query: string) =>
    api<GroceryProductCandidateDto[]>(
      `/api/Shopping/stores/${encodeURIComponent(storeCode)}/search?query=${encodeURIComponent(query)}`,
    ),

  linkIngredient: (input: LinkIngredientInput) =>
    api<void>('/api/Shopping/links', { method: 'POST', json: input }),

  linkIngredientByUrl: (input: LinkIngredientByUrlInput) =>
    api<void>('/api/Shopping/links/by-url', { method: 'POST', json: input }),

  unlink: (linkId: number) =>
    api<void>(`/api/Shopping/links/${linkId}`, { method: 'DELETE' }),

  buildRecipeDeeplink: (recipeId: number, storeCode: string, servings?: number) => {
    const qs = servings ? `?servings=${servings}` : ''
    return api<ShoppingDeeplinkResultDto>(
      `/api/Shopping/recipes/${recipeId}/${encodeURIComponent(storeCode)}${qs}`,
    )
  },

  buildDeeplink: (storeCode: string, items: DeeplinkItem[]) =>
    api<CartDeeplinkDto>('/api/Shopping/deeplink', { method: 'POST', json: { storeCode, items } }),

  listIgnored: () => api<string[]>('/api/Shopping/ignored'),

  ignore: (ingredientName: string) =>
    api<void>('/api/Shopping/ignored', { method: 'POST', json: { ingredientName } }),

  unignore: (ingredientName: string) =>
    api<void>(`/api/Shopping/ignored?ingredientName=${encodeURIComponent(ingredientName)}`, { method: 'DELETE' }),
}
