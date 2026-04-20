import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recipesApi } from '@/api/recipes'
import { ApiError } from '@/lib/api'
import { RecipeForm } from '@/components/RecipeForm'
import type { RecipeFormValues } from '@/components/RecipeForm'
import { MediaCarousel } from '@/components/MediaCarousel'
import { useConfirm } from '@/components/confirm/ConfirmDialog'

export default function RecipeEdit() {
  const { id: idParam } = useParams<{ id: string }>()
  const id = Number(idParam)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const updateMutation = useMutation({
    mutationFn: (values: RecipeFormValues) => recipesApi.update({ ...values, id }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['recipes'] })
      await qc.invalidateQueries({ queryKey: ['recipe', id] })
      navigate(`/recipes/${id}`, { replace: true })
    },
    onError: (err) => setError(extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => recipesApi.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.removeQueries({ queryKey: ['recipe', id] })
      navigate('/recipes', { replace: true })
    },
    onError: (err) => setError(extractError(err)),
  })

  if (query.isPending) {
    return <p className="eyebrow px-6 md:px-12 lg:px-20 py-20">Loading…</p>
  }

  if (query.isError) {
    return (
      <p className="px-6 md:px-12 lg:px-20 py-20 text-paprika-deep font-mono text-sm">
        Could not load recipe.
      </p>
    )
  }

  const initial: RecipeFormValues = {
    title: query.data.title,
    baseServings: query.data.baseServings,
    summary: query.data.summary,
    sourceUrl: query.data.sourceUrl,
    totalTimeMinutes: query.data.totalTimeMinutes,
    ingredients: [...query.data.ingredients]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        notes: i.notes,
      })),
    steps: query.data.steps.map((s) => s.instruction),
    tags: [...query.data.tags],
  }

  return (
    <>
      <p className="eyebrow px-6 md:px-12 lg:px-20 pt-12">Edit · {query.data.title}</p>
      <MediaCarousel recipeId={id} media={query.data.media} />
      <RecipeForm
        initial={initial}
        submitLabel="Save changes"
        isSubmitting={updateMutation.isPending}
        error={error}
        onSubmit={(values) => {
          setError(null)
          updateMutation.mutate(values)
        }}
        onCancel={() => navigate(`/recipes/${id}`)}
        extraAction={
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm.ask({
                title: `Delete "${query.data.title}"?`,
                body: 'The recipe and its photos will be removed for good. This cannot be undone.',
                confirmLabel: 'Delete recipe',
                destructive: true,
              })
              if (ok) deleteMutation.mutate()
            }}
            disabled={deleteMutation.isPending}
            className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika-deep hover:underline ml-auto disabled:opacity-50"
          >
            Delete recipe
          </button>
        }
      />
    </>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    return firstError ?? body?.detail ?? `Could not save (HTTP ${err.status}).`
  }
  return 'Something went wrong. Try again.'
}
