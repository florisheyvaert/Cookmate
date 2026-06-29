import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthForm } from '@/components/AuthForm'
import { ProviderIcon } from '@/components/ProviderIcon'
import { externalLoginApi } from '@/api/externalLogin'

// Maps the ?error= code the server redirects back with to a human message.
const EXTERNAL_ERRORS: Record<string, string> = {
  external: 'Could not complete external sign-in. Please try again.',
  email: "Your provider didn't share an email address, so we can't sign you in.",
  unverified: 'Your email address is not verified with the provider.',
  provision: 'Could not create your account. Contact an administrator.',
  link: 'Could not link your external account. Contact an administrator.',
  lockedout: 'This account is locked. Contact an administrator.',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const externalError = searchParams.get('error')
  const [error, setError] = useState<string | null>(
    externalError ? (EXTERNAL_ERRORS[externalError] ?? 'Something went wrong signing in.') : null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Available OIDC providers (Authentik, …). Absent/empty → just the password form.
  const { data: providers } = useQuery({
    queryKey: ['external-providers'],
    queryFn: () => externalLoginApi.listProviders(),
    staleTime: Infinity,
    retry: false,
  })

  async function handleSubmit(email: string, password: string) {
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      // Always land on the home planner after signing in.
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Email or password not recognised.')
      } else {
        setError('Something went wrong. Try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthForm
      eyebrow="Welcome back"
      title="Back in the kitchen."
      italicWord="kitchen"
      quote="A kitchen worth coming back to."
      submitLabel="Sign in"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit}
      footer={
        providers && providers.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-5">
              <span className="h-px flex-1 bg-cream-shadow" />
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-chestnut">
                or continue with
              </span>
              <span className="h-px flex-1 bg-cream-shadow" />
            </div>
            <div className="flex flex-col gap-3">
              {providers.map((p) => (
                <a
                  key={p.scheme}
                  href={externalLoginApi.challengeUrl(p.scheme, '/')}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 border border-cream-shadow text-ink font-display font-semibold text-[0.95rem] leading-none hover:border-paprika hover:text-paprika transition-colors"
                >
                  <ProviderIcon scheme={p.scheme} displayName={p.displayName} />
                  {p.displayName}
                </a>
              ))}
            </div>
          </div>
        ) : null
      }
    />
  )
}
