import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { usersApi } from '@/api/users'
import { ApiError } from '@/lib/api'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/auth/AuthContext'

const ease = [0.22, 1, 0.36, 1] as const

/**
 * Public redemption page. The link an admin shares looks like
 *   /redeem?u=<userId>&t=<token>&e=<email>
 * — clicking it lands here. Token is validated when the user submits.
 */
export default function Redeem() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const userId = params.get('u') ?? ''
  const token = params.get('t') ?? ''
  const email = params.get('e') ?? ''

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => usersApi.redeem(userId, token, password),
    onSuccess: async () => {
      await refresh()
      navigate('/recipes', { replace: true })
    },
    onError: (err) => setError(extractError(err)),
  })

  const linkOk = userId && token

  return (
    <div
      className="min-h-screen flex items-center justify-center grain px-6 py-10"
      style={{
        background:
          'radial-gradient(80% 60% at 100% 0%, rgba(232,90,26,0.10), transparent 60%),' +
          'radial-gradient(70% 60% at 0% 100%, rgba(123,94,63,0.10), transparent 60%),' +
          'var(--color-cream)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease }}
        className="grain relative w-full max-w-md border border-chestnut/30 bg-cream-deep/30 rounded-sm shadow-[0_32px_80px_-24px_rgba(26,20,16,0.4)]"
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-paprika text-cream font-mono text-[0.6rem] uppercase tracking-[0.22em]">
          ❦ · Welcome
        </div>

        <div className="px-8 md:px-10 pt-12 pb-10">
          <div className="flex justify-center mb-5">
            <Logo size={36} className="text-paprika" />
          </div>

          {!linkOk ? (
            <>
              <h1
                className="font-display text-ink text-center mb-3"
                style={{
                  fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
                }}
              >
                This link is missing pieces.
              </h1>
              <p className="font-display text-ink-soft text-sm text-center mt-3">
                Ask whoever invited you for a fresh link.
              </p>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (password) mutation.mutate()
              }}
              autoComplete="on"
            >
              <p className="eyebrow text-center mb-2">Set your password</p>
              <h1
                className="font-display text-ink text-center mb-2"
                style={{
                  fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
                }}
              >
                Hello{email ? ',' : '.'}
                {email && (
                  <>
                    {' '}
                    <span
                      className="italic text-paprika block mt-1 break-words"
                      style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
                    >
                      {email}
                    </span>
                  </>
                )}
              </h1>
              <p className="font-display text-ink-soft text-sm text-center mt-3 mb-7 leading-relaxed">
                Choose a password to unlock the cookbook. You can change it later.
              </p>

              {/* Hidden username field so password managers store credentials under the right account. */}
              <input
                type="email"
                name="email"
                value={email}
                readOnly
                hidden
                autoComplete="username"
              />

              <label className="block mb-5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-chestnut">
                    — Password
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-chestnut-soft hover:text-paprika transition-colors"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least 8 characters"
                  disabled={mutation.isPending}
                  className="w-full bg-transparent border-0 border-b border-chestnut/40 focus:border-paprika focus:outline-none py-1.5 font-display text-ink text-xl placeholder:text-chestnut-soft placeholder:font-mono placeholder:text-sm transition-colors disabled:opacity-60"
                  style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                />
              </label>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-mono text-[0.76rem] text-paprika-deep mb-3 border-l-2 border-paprika pl-3 py-1"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={mutation.isPending || password.length < 8}
                className="mt-3 w-full inline-flex items-center justify-center gap-3 px-7 py-3 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.78rem] hover:bg-paprika transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? 'Unlocking…' : 'Open the cookbook'}
                <span aria-hidden>→</span>
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function extractError(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]>; title?: string; detail?: string } | null
    const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : null
    if (firstError) return firstError
    if (err.status === 404 || err.status === 400) {
      return 'This link is no longer valid. Ask for a fresh one.'
    }
    return body?.detail ?? body?.title ?? `Could not redeem (HTTP ${err.status}).`
  }
  return 'Something went wrong. Try again.'
}
