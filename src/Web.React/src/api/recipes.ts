import { api } from '@/lib/api'
import type {
  CreateRecipeInput,
  RecipeDto,
  RecipeSummaryDto,
  UpdateRecipeInput,
} from '@/api/types'

export const recipesApi = {
  list: (params?: {
    search?: string
    tag?: string
    source?: string
    maxTimeMinutes?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.tag) qs.set('tag', params.tag)
    if (params?.source) qs.set('source', params.source)
    if (params?.maxTimeMinutes != null) qs.set('maxTimeMinutes', String(params.maxTimeMinutes))
    const suffix = qs.toString()
    return api<RecipeSummaryDto[]>(`/api/Recipes${suffix ? `?${suffix}` : ''}`)
  },

  get: (id: number, servings?: number) => {
    const qs = servings ? `?servings=${servings}` : ''
    return api<RecipeDto>(`/api/Recipes/${id}${qs}`)
  },

  create: (input: CreateRecipeInput) =>
    api<number>('/api/Recipes', { method: 'POST', json: input }),

  importFromUrl: (url: string) =>
    api<number>('/api/Recipes/import', { method: 'POST', json: { url } }),

  update: (input: UpdateRecipeInput) =>
    api<void>(`/api/Recipes/${input.id}`, { method: 'PUT', json: input }),

  remove: (id: number) =>
    api<void>(`/api/Recipes/${id}`, { method: 'DELETE' }),

  uploadMedia: (id: number, file: File, caption?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (caption) fd.append('caption', caption)
    return api<number>(`/api/Recipes/${id}/media`, {
      method: 'POST',
      body: fd,
    })
  },

  importMediaFromUrl: (id: number, url: string, caption?: string) =>
    api<number>(`/api/Recipes/${id}/media/import`, {
      method: 'POST',
      json: { recipeId: id, url, caption },
    }),

  removeMedia: (id: number, mediaId: number) =>
    api<void>(`/api/Recipes/${id}/media/${mediaId}`, { method: 'DELETE' }),
}
