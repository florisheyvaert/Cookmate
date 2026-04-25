import { useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Logo'
import { useTheme } from '@/components/ThemeProvider'
import type { Theme } from '@/lib/theme'

const ease = [0.22, 1, 0.36, 1] as const

const chapters = [
  { to: '/recipes', label: 'Recipes', numeral: 'I' },
  { to: '/pantry', label: 'Pantry', numeral: 'II' },
  { to: '/shop', label: 'Shop', numeral: 'III' },
]

type AppMenuProps = {
  open: boolean
  onClose: () => void
}

export function AppMenu({ open, onClose }: AppMenuProps) {
  const { user, isAdmin, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // Close on route change.
  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Lock scroll + Escape to close while open.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
    }
  }, [open, onClose])

  async function handleLogout() {
    await logout()
    onClose()
    navigate('/', { replace: true })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease }}
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{
            background:
              'radial-gradient(80% 60% at 100% 0%, rgba(232,90,26,0.15), transparent 60%),' +
              'radial-gradient(70% 60% at 0% 100%, rgba(123,94,63,0.12), transparent 60%),' +
              'var(--color-cream)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
        >
          <header className="px-6 md:px-12 lg:px-20 pt-8 pb-6 flex items-baseline justify-between">
            <Link
              to="/"
              onClick={onClose}
              className="flex items-baseline gap-3 text-paprika no-underline"
            >
              <Logo size={28} className="translate-y-1" />
              <span className="font-display text-[1.6rem] tracking-tight text-ink leading-none">
                Cookmate
              </span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="font-mono text-[0.78rem] uppercase tracking-[0.22em] text-chestnut hover:text-paprika transition-colors flex items-baseline gap-2"
            >
              Close
              <span aria-hidden className="text-paprika text-base">×</span>
            </button>
          </header>

          <nav className="px-6 md:px-12 lg:px-20 mt-8 md:mt-16">
            <p className="eyebrow mb-8">Inside this issue</p>
            <ul className="space-y-3 md:space-y-5">
              {chapters.map((c, i) => (
                <motion.li
                  key={c.to}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.07, duration: 0.55, ease }}
                >
                  <NavLink
                    to={c.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      [
                        'group flex items-baseline gap-5 md:gap-8 no-underline transition-colors',
                        isActive ? 'text-paprika' : 'text-ink hover:text-paprika',
                      ].join(' ')
                    }
                  >
                    <span
                      className="num text-chestnut text-sm md:text-base w-10 text-right"
                      style={{ fontFeatureSettings: '"tnum"' }}
                    >
                      {c.numeral}.
                    </span>
                    <span
                      className="font-display"
                      style={{
                        fontSize: 'clamp(2.6rem, 9vw, 7rem)',
                        lineHeight: 0.9,
                        letterSpacing: '-0.035em',
                        fontVariationSettings: '"opsz" 144, "SOFT" 30, "WONK" 1',
                      }}
                    >
                      {c.label}
                    </span>
                  </NavLink>
                </motion.li>
              ))}
            </ul>
          </nav>

          <motion.footer
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.55, ease }}
            className="absolute inset-x-0 bottom-0 px-6 md:px-12 lg:px-20 pb-10 pt-6 border-t border-cream-shadow space-y-5"
          >
            {/* Theme switch */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="eyebrow">Theme</span>
              <ThemePill value={theme} onChange={setTheme} />
            </div>

            {/* User block */}
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              {user ? (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap min-w-0">
                    <span className="eyebrow">Signed in as</span>
                    <span
                      className="font-display text-ink text-lg md:text-xl truncate max-w-[60vw]"
                      style={{ fontVariationSettings: '"opsz" 24, "SOFT" 50, "WONK" 0' }}
                    >
                      {user.email}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-5 flex-wrap">
                    {isAdmin && (
                      <Link
                        to="/users"
                        onClick={onClose}
                        className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors no-underline"
                      >
                        Members →
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
                    >
                      Sign out →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="eyebrow">Not signed in</span>
                  <Link
                    to="/login"
                    onClick={onClose}
                    className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-paprika hover:underline no-underline"
                  >
                    Sign in →
                  </Link>
                </>
              )}
            </div>
          </motion.footer>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function ThemePill({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 border border-chestnut/30 rounded-sm p-0.5 bg-cream-deep/40"
    >
      {themeOptions.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={[
              'px-2.5 py-1 font-mono uppercase tracking-[0.16em] text-[0.62rem] transition-colors rounded-sm',
              active
                ? 'bg-paprika text-cream'
                : 'text-chestnut hover:text-paprika',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
