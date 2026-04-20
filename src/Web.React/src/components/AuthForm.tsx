import type { FormEvent } from 'react'
import { motion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1] as const

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
 * A single focused login card — centred vertically within the main area so it
 * fits the viewport without scrolling, given the Layout's header and footer.
 * Styled as an editorial "checkout card" from a library catalogue: paper panel,
 * chestnut hairline, paprika accents, numbered fields.
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

  const titleParts = italicWord
    ? title.split(italicWord).flatMap((part, i, arr) =>
        i < arr.length - 1
          ? [
              part,
              <span
                key={i}
                className="italic text-paprika"
                style={{ fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1' }}
              >
                {italicWord}
              </span>,
            ]
          : [part],
      )
    : [title]

  return (
    <div className="h-full flex items-center justify-center px-6 py-10 md:py-14">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease }}
        className="grain relative w-full max-w-md border border-chestnut/30 bg-cream-deep/30 rounded-sm shadow-[0_24px_60px_-24px_rgba(26,20,16,0.35)]"
      >
        {/* Paprika ornament tab at the top — reads as a printed library tab */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-paprika text-cream font-mono text-[0.6rem] uppercase tracking-[0.22em]">
          ❦ · Cookmate
        </div>

        <div className="px-8 md:px-10 pt-12 pb-8">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45, ease }}
            className="eyebrow text-center"
          >
            {eyebrow}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.6, ease }}
            className="font-display text-ink text-center mt-3 mb-7"
            style={{
              fontSize: 'clamp(2rem, 4.6vw, 3rem)',
              lineHeight: 1,
              letterSpacing: '-0.025em',
              fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
            }}
          >
            {titleParts}
          </motion.h1>

          <form onSubmit={handleSubmit}>
            <NumberedField
              number="01"
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
            <NumberedField
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
                className="font-mono text-[0.76rem] text-paprika-deep mt-1 border-l-2 border-paprika pl-3 py-1"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full inline-flex items-center justify-center gap-3 px-7 py-3 bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[0.78rem] hover:bg-paprika transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Working…' : submitLabel}
              <span aria-hidden>→</span>
            </button>
          </form>
        </div>

        {quote && (
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
              {quote}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

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
