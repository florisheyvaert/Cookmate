import { api } from '@/lib/api'

// Enum mirrors Cookmate.Domain.Enums.MealSlot. System.Text.Json serialises
// enums as numbers (same as RecipeMediaType in types.ts).
export type MealSlot = 1 | 2 | 3 | 4 // 1=Dinner, 2=Breakfast, 3=Lunch, 4=Snack

export const MealSlots = {
  Dinner: 1,
  Breakfast: 2,
  Lunch: 3,
  Snack: 4,
} as const

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  1: 'Dinner',
  2: 'Breakfast',
  3: 'Lunch',
  4: 'Snack',
}

/** Single-letter slot codes for tight spaces (month grid). */
export const MEAL_SLOT_SHORT: Record<MealSlot, string> = {
  1: 'D',
  2: 'B',
  3: 'L',
  4: 'S',
}

/** Meal-slot icons — instantly readable in tight cells (clearer than letters). */
export const MEAL_SLOT_ICON: Record<MealSlot, string> = {
  1: '🍽️', // Dinner
  2: '🍳', // Breakfast
  3: '🥪', // Lunch
  4: '🍎', // Snack
}

/** Display order: dinner first (the primary slot), then chronological. */
export const MEAL_SLOT_ORDER: MealSlot[] = [1, 2, 3, 4]

export type MealEntryDto = {
  id: number
  /** ISO date, yyyy-MM-dd. */
  date: string
  slot: MealSlot
  recipeId: number | null
  recipeTitle: string | null
  freeText: string | null
  servings: number | null
  notes: string | null
  /** Dish photo from the linked recipe or suggestion, or null when none. */
  imageUrl: string | null
}

export type CreateMealEntryInput = {
  date: string
  slot: MealSlot
  recipeId: number | null
  freeText: string | null
  servings: number | null
  notes: string | null
  /** Optional harvested suggestion this entry came from (carries its photo). */
  suggestionId?: number | null
}

export type UpdateMealEntryInput = CreateMealEntryInput & { id: number }

export const mealPlanApi = {
  list: (range: { from: string; to: string }) =>
    api<MealEntryDto[]>(
      `/api/MealPlan?from=${range.from}&to=${range.to}`,
    ),

  suggestions: (query?: string) => {
    const qs = query ? `?query=${encodeURIComponent(query)}` : ''
    return api<string[]>(`/api/MealPlan/suggestions${qs}`)
  },

  create: (input: CreateMealEntryInput) =>
    api<number>('/api/MealPlan', { method: 'POST', json: input }),

  update: (input: UpdateMealEntryInput) =>
    api<void>(`/api/MealPlan/${input.id}`, { method: 'PUT', json: input }),

  remove: (id: number) =>
    api<void>(`/api/MealPlan/${id}`, { method: 'DELETE' }),
}
