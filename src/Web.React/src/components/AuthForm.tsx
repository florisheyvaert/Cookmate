import type { FormEvent, ReactNode } from 'react'
import { motion } from 'motion/react'
import { Logo } from '@/components/Logo'

const ease = [0.22, 1, 0.36, 1] as const

// Fixed light colours for the dark-forest brand panel (theme-independent).
const LIGHT = '#f3efe4'
const MUTED = 'rgba(243, 239, 228, 0.66)'
const GOLD = '#e6b23e'

type AuthFormProps = {
  eyebrow: string
  title: string
  italicWord?: string
  quote?: string
  submitLabel: string
  isSubmitting: boolean
  error: string | null
  onSubmit: (email: string, password: string) => void
}

/**
 * Full-page split login — a deep-forest brand panel (left, desktop only) beside
 * the form panel (right / full width on mobile). Rendered outside the app
 * Layout, so there is no header or footer. The form panel themes with the rest
 * of the app (light + dark); the brand panel stays fixed dark green.
 */
export function AuthForm({
  eyebrow,
  title,
  italicWord,
  quote,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
}: AuthFormProps) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    onSubmit(String(data.get('email') ?? ''), String(data.get('password') ?? ''))
  }

  const titleParts: ReactNode[] = italicWord
    ? title.split(italicWord).flatMap((part, i, arr) =>
        i < arr.length - 1
          ? [part, <span key={i} className="italic" style={{ fontFamily: 'var(--font-body)', color: GOLD }}>{italicWord}</span>]
          : [part],
      )
    : [title]

  return (
    <div className="min-h-svh w-full bg-cream grid lg:grid-cols-[1.1fr_1fr]">
      {/* ── Brand panel (desktop) ─────────────────────────────────────── */}
      <aside
        className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden"
        style={{
          background:
            'radial-gradient(80% 70% at 100% 0%, rgba(47,125,79,0.5), transparent 55%),' +
            'radial-gradient(70% 70% at 0% 100%, rgba(224,165,46,0.2), transparent 55%),' +
            'linear-gradient(155deg, #213b2b 0%, #16241b 100%)',
        }}
      >
        <span
          aria-hidden
          className="absolute -right-10 -bottom-16 select-none leading-none"
          style={{ fontFamily: 'var(--font-display)', fontSize: '32rem', fontWeight: 800, color: 'rgba(243,239,228,0.045)' }}
        >
          ❧
        </span>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="relative flex items-center gap-2.5"
          style={{ color: LIGHT }}
        >
          <Logo size={30} />
          <span className="font-display leading-none" style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
            Cookmate
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.7, ease }}
          className="relative max-w-lg"
        >
          <p className="font-mono uppercase text-[0.68rem] tracking-[0.22em] mb-5" style={{ color: GOLD }}>
            {eyebrow}
          </p>
          <h1
            className="font-display"
            style={{ color: LIGHT, fontSize: 'clamp(2.6rem, 4vw, 4.2rem)', lineHeight: 0.98, fontWeight: 800, letterSpacing: '-0.035em' }}
          >
            {titleParts}
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-md" style={{ color: MUTED, fontFamily: 'var(--font-body)' }}>
            Save the recipes you actually cook, plan the week ahead, and keep the whole kitchen in one place.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="relative font-mono text-[0.68rem] uppercase tracking-[0.18em] flex items-center gap-3"
          style={{ color: MUTED }}
        >
          <span style={{ color: GOLD }} aria-hidden>❧</span>
          {quote ?? 'Cookmate · Vol. 01'}
        </motion.p>
      </aside>

      {/* ── Form panel ────────────────────────────────────────────────── */}
      <main className="flex items-center justify-center px-6 sm:px-10 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="w-full max-w-sm"
        >
          {/* mobile brand lockup */}
          <div className="flex lg:hidden items-center gap-2.5 text-paprika mb-10">
            <Logo size={26} />
            <span className="font-display text-ink leading-none" style={{ fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>
              Cookmate
            </span>
          </div>

          <p className="eyebrow text-paprika mb-2.5">{eyebrow}</p>
          <h2
            className="font-display text-ink mb-8"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 2.3rem)', lineHeight: 1.02, fontWeight: 700, letterSpacing: '-0.025em' }}
          >
            Sign in
          </h2>

          <form onSubmit={handleSubmit}>
            <Field number="01" label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
            <Field
              number="02"
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={6}
              required
              placeholder="••••••••"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="font-mono text-[0.74rem] text-butter-deep mt-1 pl-3 py-1 border-l-2 border-butter"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 bg-paprika text-cream font-display font-semibold text-[0.95rem] leading-none hover:bg-paprika-deep transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Working…' : submitLabel}
              <span aria-hidden>→</span>
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  )
}

type FieldProps = {
  number: string
  label: string
  name: string
  type: string
  autoComplete: string
  required?: boolean
  minLength?: number
  placeholder?: string
}

function Field({ number, label, name, type, autoComplete, required, minLength, placeholder }: FieldProps) {
  return (
    <label className="block mb-6">
      <span className="flex items-baseline gap-2.5 mb-2">
        <span className="num text-paprika text-xs">{number}</span>
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.2em] text-chestnut">{label}</span>
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 border-b border-cream-shadow focus:border-paprika focus:outline-none py-2 text-lg text-ink placeholder:text-chestnut-soft placeholder:font-mono placeholder:text-sm transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      />
    </label>
  )
}
