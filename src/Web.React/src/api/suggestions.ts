import { api } from '@/lib/api'

// Enums mirror the backend; System.Text.Json serialises them as numbers.
// HarvestStatus: 0=Succeeded, 1=PartialFailure, 2=Failed, 3=Processing
// HarvestItemStatus: 0=Inserted, 1=SkippedDuplicate, 2=Failed
// HarvestTrigger: 0=Scheduled, 1=Manual
export const HARVEST_STATUS_PROCESSING = 3

export const HARVEST_STATUS_LABELS: Record<number, string> = {
  0: 'Succeeded',
  1: 'Partial',
  2: 'Failed',
  3: 'Processing',
}

export const HARVEST_ITEM_STATUS_LABELS: Record<number, string> = {
  0: 'Inserted',
  1: 'Duplicate',
  2: 'Failed',
}

export const HARVEST_TRIGGER_LABELS: Record<number, string> = {
  0: 'Scheduled',
  1: 'Manual',
}

export type MealSuggestionDto = {
  id: number
  title: string
  summary: string | null
  sourceUrl: string
  sourceId: number
  sourceName: string | null
  baseServings: number
  totalTimeMinutes: number | null
  tags: string[]
  /** ISO date, yyyy-MM-dd. */
  harvestedOn: string
  imageUrl: string | null
}

export type SuggestionIngredient = {
  name: string
  amount: number
  unit: string | null
  notes: string | null
}

export type MealSuggestionDetail = {
  id: number
  title: string
  summary: string | null
  sourceUrl: string
  sourceId: number
  sourceName: string | null
  baseServings: number
  totalTimeMinutes: number | null
  tags: string[]
  harvestedOn: string
  imageUrl: string | null
  ingredients: SuggestionIngredient[]
  steps: string[]
}

export type WeeklyProposalDay = {
  /** ISO date, yyyy-MM-dd. */
  date: string
  suggestion: MealSuggestionDto | null
}

export type WeeklyProposal = {
  weekStart: string
  days: WeeklyProposalDay[]
}

export type SuggestionSourceDto = {
  id: number
  name: string
  host: string
  enabled: boolean
  listingUrls: string[]
  maxPerRun: number | null
  lastRunAt: string | null
  lastRunStatus: number | null
  lastRunCount: number | null
}

export type HarvestSchedule = {
  enabled: boolean
  /** 0 = Sunday … 6 = Saturday (System.DayOfWeek). */
  dayOfWeek: number
  /** Local time "HH:mm". */
  timeOfDay: string
}

export type SuggestionSourceInput = {
  name: string
  host: string
  enabled: boolean
  listingUrls: string[]
  maxPerRun: number | null
}

export type HarvestItemLog = {
  url: string
  status: number
  title: string | null
  error: string | null
}

export type HarvestSourceLog = {
  sourceId: number | null
  sourceName: string
  host: string
  discovered: number
  inserted: number
  skippedDuplicate: number
  failed: number
  error: string | null
  items: HarvestItemLog[]
}

export type HarvestReport = {
  runId: number
  trigger: number
  status: number
  startedAt: string
  finishedAt: string | null
  discovered: number
  inserted: number
  skippedDuplicate: number
  failed: number
  sources: HarvestSourceLog[]
}

export type SuggestionTagCount = { tag: string; count: number }
export type SuggestionFacets = { total: number; tags: SuggestionTagCount[] }

export type FacetParams = {
  search?: string
  sourceId?: number
  maxTimeMinutes?: number
}

export type SuggestionSort = 'newest' | 'oldest' | 'title'

export type BrowseParams = {
  search?: string
  tag?: string
  sourceId?: number
  maxTimeMinutes?: number
  sort?: SuggestionSort
  page?: number
  pageSize?: number
}

/** Page size used by the infinite-scroll browse. Kept in the API module so the
 *  client and the "is there a next page?" check agree on one value. */
export const SUGGESTIONS_PAGE_SIZE = 24

export const suggestionsApi = {
  browse: (params?: BrowseParams) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.tag) qs.set('tag', params.tag)
    if (params?.sourceId != null) qs.set('sourceId', String(params.sourceId))
    if (params?.maxTimeMinutes != null) qs.set('maxTimeMinutes', String(params.maxTimeMinutes))
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize))
    const suffix = qs.toString()
    return api<MealSuggestionDto[]>(`/api/MealSuggestions${suffix ? `?${suffix}` : ''}`)
  },

  facets: (params?: FacetParams) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.sourceId != null) qs.set('sourceId', String(params.sourceId))
    if (params?.maxTimeMinutes != null) qs.set('maxTimeMinutes', String(params.maxTimeMinutes))
    const suffix = qs.toString()
    return api<SuggestionFacets>(`/api/MealSuggestions/facets${suffix ? `?${suffix}` : ''}`)
  },

  get: (id: number) => api<MealSuggestionDetail>(`/api/MealSuggestions/${id}`),

  weekly: () => api<WeeklyProposal>('/api/MealSuggestions/weekly'),

  /** This week's ~50 main-course ideas (catalog-style, reshuffled weekly). */
  weeklyIdeas: () => api<MealSuggestionDto[]>('/api/MealSuggestions/weekly-ideas'),

  sources: {
    list: () => api<SuggestionSourceDto[]>('/api/SuggestionSources'),

    create: (input: SuggestionSourceInput) =>
      api<number>('/api/SuggestionSources', { method: 'POST', json: input }),

    update: (id: number, input: SuggestionSourceInput) =>
      api<void>(`/api/SuggestionSources/${id}`, { method: 'PUT', json: { id, ...input } }),

    remove: (id: number) =>
      api<void>(`/api/SuggestionSources/${id}`, { method: 'DELETE' }),

    harvest: (id?: number) =>
      id == null
        ? api<HarvestReport>('/api/SuggestionSources/harvest', { method: 'POST' })
        : api<HarvestReport>(`/api/SuggestionSources/${id}/harvest`, { method: 'POST' }),

    runs: (id?: number) =>
      id == null
        ? api<HarvestReport[]>('/api/SuggestionSources/runs')
        : api<HarvestReport[]>(`/api/SuggestionSources/${id}/runs`),
  },

  schedule: {
    get: () => api<HarvestSchedule>('/api/SuggestionSources/schedule'),
    update: (input: HarvestSchedule) => api<void>('/api/SuggestionSources/schedule', { method: 'PUT', json: input }),
  },
}
