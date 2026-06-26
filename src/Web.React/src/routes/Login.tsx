import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthForm } from '@/components/AuthForm'
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

/**
 * Brand icon for a known external provider, matched on scheme/display name.
 * Falls back to no icon for providers we don't have a logo for, so a future
 * generic OIDC provider still renders a clean button.
 */
function ProviderIcon({ scheme, displayName }: { scheme: string; displayName: string }) {
  const key = `${scheme} ${displayName}`.toLowerCase()
  if (key.includes('authentik')) return <AuthentikLogo size={18} />
  return null
}

// Official Authentik mark (goauthentik.io). Keeps its brand colour on the button.
function AuthentikLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <g transform="translate(1 117.03)" fill="#fd4b2d">
        <path d="M829.67,0h-425.28c-93.1,0-169.27,76.17-169.27,169.27v425.28c0,93.1,76.17,169.27,169.27,169.27h50.18v-165.68h324.96v165.68h50.14c93.1,0,169.27-76.17,169.27-169.27V169.27C998.94,76.17,922.77,0,829.67,0ZM755.98,463.53H235.4v-114.49h268.96v-158.97h43.68v94.7h25.61v-94.7h30.88v69.64h25.61v-69.64h30.88v116.35h25.61v-116.35h43.68v158.97h25.69v114.49Z" />
        <path d="M237.36,342.19h-.02c-25.34-34.27-63.32-69.15-105.42-69.15-48.4.03-92.89,26.58-115.91,69.15-48.08,83.85,18.39,196.94,115.91,194.36,75.46,0,137.69-111.95,137.69-131.75,0-8.76-12.18-35.49-32.25-62.61ZM77.32,342.19c27.16-23.43,66.59-30.27,95.1,0h.02c21.51,19.51,40.28,47.91,47.08,62.35-84.6,176.88-232.87,26.13-142.2-62.35Z" />
      </g>
    </svg>
  )
}
