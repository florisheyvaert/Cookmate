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

export type RecipeSelection = {
  recipeId: number
  servings: number | null
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

  buildListDeeplink: (storeCode: string, selections: RecipeSelection[]) =>
    api<ShoppingDeeplinkResultDto>(
      `/api/Shopping/list/${encodeURIComponent(storeCode)}`,
      { method: 'POST', json: { selections } },
    ),
}
