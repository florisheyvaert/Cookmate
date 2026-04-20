import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recipesApi } from '@/api/recipes'
import { ApiError } from '@/lib/api'
import { RecipeForm } from '@/components/RecipeForm'
import type { RecipeFormValues } from '@/components/RecipeForm'
import { ImportFromUrlPanel } from '@/components/ImportFromUrlPanel'

export default function RecipeNew() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (values: RecipeFormValues) => recipesApi.create(values),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ['recipes'] })
      navigate(`/recipes/${id}`, { replace: true })
    },
    onError: (err) => setError(extractError(err)),
  })

  return (
    <>
      <p className="eyebrow px-6 md:px-12 lg:px-20 pt-12 mb-2">New recipe · Vol. 01</p>
      <ImportFromUrlPanel />
      <RecipeForm
        submitLabel="Save recipe"
        isSubmitting={mutation.isPending}
        error={error}
        onSubmit={(values) => {
          setError(null)
          mutation.mutate(values)
        }}
        onCancel={() => navigate(-1)}
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
