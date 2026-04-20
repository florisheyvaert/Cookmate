// Handwritten DTO mirrors of src/Application/Recipes/**.
// Run `npm run gen:api` against a running API to regenerate src/api/schema.d.ts
// from /openapi/v1.json — at that point this file can be replaced by openapi-fetch.

export type RecipeMediaType = 1 | 2 // 1 = Photo, 2 = Video

export type RecipeSummaryDto = {
  id: number
  title: string
  summary: string | null
  sourceUrl: string | null
  baseServings: number
  totalTimeMinutes: number | null
  tags: string[]
}

export type RecipeIngredientDto = {
  id: number
  order: number
  name: string
  amount: number
  unit: string
  notes: string | null
}

export type RecipeStepDto = {
  id: number
  order: number
  instruction: string
}

export type RecipeMediaDto = {
  id: number
  order: number
  url: string
  type: RecipeMediaType
  caption: string | null
}

export type RecipeDto = {
  id: number
  title: string
  summary: string | null
  sourceUrl: string | null
  baseServings: number
  servedFor: number
  totalTimeMinutes: number | null
  tags: string[]
  ingredients: RecipeIngredientDto[]
  steps: RecipeStepDto[]
  media: RecipeMediaDto[]
}

export type CreateRecipeIngredientInput = {
  name: string
  amount: number
  unit: string | null
  notes: string | null
}

export type CreateRecipeInput = {
  title: string
  baseServings: number
  summary: string | null
  sourceUrl: string | null
  totalTimeMinutes: number | null
  ingredients: CreateRecipeIngredientInput[]
  steps: string[]
  tags: string[]
}

export type UpdateRecipeInput = CreateRecipeInput & { id: number }

