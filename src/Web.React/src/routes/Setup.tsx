import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { setupApi } from '@/api/setup'
import { externalLoginApi } from '@/api/externalLogin'
import { ApiError } from '@/lib/api'
import { btnPrimary } from '@/lib/ui'
import { Logo } from '@/components/Logo'
import { ProviderIcon } from '@/components/ProviderIcon'

const ease = [0.22, 1, 0.36, 1] as const

// The OIDC callback redirects back with a ?error= code if onboarding via a
// provider fails. During first-run the SetupGate renders this screen for every
// path (including the /login the callback targets), so we surface it here too.
const EXTERNAL_ERRORS: Record<string, string> = {
  external: 'Could not complete external sign-in. Please try again.',
  email: "Your provider didn't share an email address, so we can't create your account.",
  unverified: 'Your email address is not verified with the provider.',
  provision: 'Could not create your account from the provider. Try again.',
  link: 'Could not link your external account. Try again.',
  lockedout: 'This account is locked.',
}

/**
 * First-run onboarding. Shown automatically while the database has zero users.
 * Submitting creates the administrator account, signs in via cookies, and then
 * performs a full-page navigation to /recipes so password managers reliably
 * detect the submission and offer to save the credentials.
 */
export default function Setup() {
  const [searchParams] = useSearchParams()
  const externalError = searchParams.get('error')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(
    externalError ? (EXTERNAL_ERRORS[externalError] ?? 'Something went wrong signing in.') : null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Available OIDC providers (Authentik, …). The first person to sign in via a
  // provider becomes the administrator, exactly like completing the form does.
  // Absent/empty → just the password form below.
  const { data: providers } = useQuery({
    queryKey: ['external-providers'],
    queryFn: () => externalLoginApi.listProviders(),
    staleTime: Infinity,
    retry: false,
  })

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    setIsSubmitting(true)
    try {
      await setupApi.complete(email, password)
      // Full-page reload signals the password manager to offer saving, and
      // re-initialises the app with the fresh auth cookie. Land on the home
      // planner, consistent with signing in.
      window.location.href = '/'
    } catch (err) {
      setError(extractError(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center grain px-6 py-10"
      style={{
        background:
          'radial-gradient(80% 60% at 100% 0%, rgba(47,125,79,0.10), transparent 60%),' +
          'radial-gradient(70% 60% at 0% 100%, rgba(224,165,46,0.10), transparent 60%),' +
          'var(--color-cream)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease }}
        className="grain relative w-full max-w-md border border-chestnut/30 bg-cream-deep/30 rounded-sm shadow-[0_32px_80px_-24px_rgba(26,20,16,0.4)]"
      >
        {/* Library-tab header */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-paprika text-cream font-mono text-[0.6rem] uppercase tracking-[0.22em]">
          ❦ · First volume
        </div>

        <div className="px-8 md:px-10 pt-12 pb-8">
          {/* Logo mark centred above the step label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex justify-center mb-5"
          >
            <Logo size={36} className="text-paprika" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45, ease }}
            className="eyebrow text-center"
          >
            <span>Step</span>{' '}
            <span className="num text-paprika">01</span>{' '}
            <span className="text-chestnut-soft" aria-hidden>of</span>{' '}
            <span className="num">01</span>
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.6, ease }}
            className="font-display text-ink text-center mt-3 mb-3"
            style={{
              fontSize: 'clamp(2rem, 4.6vw, 3rem)',
              lineHeight: 1,
              letterSpacing: '-0.025em',
              fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
            }}
          >
            Start your{' '}
            <span
              className="italic text-paprika"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
            >
              cookbook
            </span>
            .
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.5 }}
            className="font-display text-ink-soft text-sm text-center max-w-xs mx-auto mb-7 leading-relaxed"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
          >
            A one-time setup. After this, it's your kitchen — no one else signs in.
          </motion.p>

          <form onSubmit={handleSubmit} autoComplete="on">
            <NumberedField
              number="01"
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@example.com"
            />

            <PasswordField
              number="02"
              show={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="font-mono text-[0.76rem] text-paprika-deep mt-1 border-l-2 border-paprika pl-3 py-1"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${btnPrimary} mt-6 w-full`}
            >
              {isSubmitting ? 'Planting the flag…' : 'Open the cookbook'}
              <span aria-hidden>→</span>
            </button>

            <p className="font-mono text-[0.62rem] text-chestnut-soft text-center mt-4 leading-relaxed">
              Your browser may offer to save these credentials.
            </p>
          </form>

          {providers && providers.length > 0 && (
            <div className="mt-7">
              <div className="flex items-center gap-3 mb-5">
                <span className="h-px flex-1 bg-cream-shadow" />
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-chestnut">
                  or set up with
                </span>
                <span className="h-px flex-1 bg-cream-shadow" />
              </div>
              <div className="flex flex-col gap-3">
                {providers.map((p) => (
                  <a
                    key={p.scheme}
                    href={externalLoginApi.challengeUrl(p.scheme, '/recipes')}
                    className="w-full inline-flex items-center justify-center gap-2.5 rounded-sm px-7 py-3 border border-chestnut/40 text-ink font-display font-semibold text-[0.95rem] leading-none hover:border-paprika hover:text-paprika transition-colors"
                  >
                    <ProviderIcon scheme={p.scheme} displayName={p.displayName} />
                    {p.displayName}
                  </a>
                ))}
              </div>
              <p className="font-mono text-[0.62rem] text-chestnut-soft text-center mt-4 leading-relaxed">
                The first person to sign in becomes the owner.
              </p>
            </div>
          )}
        </div>

        {/* Editorial closing quote */}
        <div className="px-8 md:px-10 pb-7 pt-1">
          <div className="flex items-center gap-4">
            <span className="flex-1 h-px bg-cream-shadow" />
            <span
              className="text-paprika text-base font-display leading-none"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
            >
              ❦
            </span>
            <span className="flex-1 h-px bg-cream-shadow" />
          </div>
          <p
            className="font-display italic text-chestnut text-sm text-center mt-3"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 70, "WONK" 1' }}
          >
            A blank page, ready for your first recipe.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────

type NumberedFieldProps = {
  number: string
  label: string
  name: string
  type: string
  autoComplete: string
  required?: boolean
  minLength?: number
  placeholder?: string
}

function NumberedField({
  number,
  label,
  name,
  type,
  autoComplete,
  required,
  minLength,
  placeholder,
}: NumberedFieldProps) {
  return (
    <label className="block mb-5">
      <div className="flex items-baseline gap-2.5 mb-1.5">
        <span className="num text-paprika text-xs">{number}</span>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-chestnut">
          — {label}
        </span>
      </div>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 border-b border-chestnut/40
                   focus:border-paprika focus:outline-none py-1.5
                   font-display text-ink text-xl
                   placeholder:text-chestnut-soft placeholder:font-mono placeholder:text-sm
                   transition-colors"
        style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
      />
    </label>
  )
}

function PasswordField({
  number,
  show,
  onToggle,
}: {
  number: string
  show: boolean
  onToggle: () => void
}) {
  return (
    <label className="block mb-5">
      <div className="flex items-baseline gap-2.5 mb-1.5">
        <span className="num text-paprika text-xs">{number}</span>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-chestnut">
          — Password
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.18em] text-chestnut-soft hover:text-paprika transition-colors"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <input
        name="password"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="at least 8 characters"
        className="w-full bg-transparent border-0 border-b border-chestnut/40
                   focus:border-paprika focus:outline-none py-1.5
                   font-display text-ink text-xl
                   placeholder:text-chestnut-soft placeholder:font-mono placeholder:text-sm
                   transition-colors"
        style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
      />
    </label>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; title?: string; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    if (firstError) return firstError
    if (err.status === 409) return body?.detail ?? 'Setup is already completed.'
    return body?.detail ?? body?.title ?? `Setup failed (HTTP ${err.status}).`
  }
  return 'Something went wrong. Try again.'
}
