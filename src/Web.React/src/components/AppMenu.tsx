import { useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Logo'

const ease = [0.22, 1, 0.36, 1] as const

// Fixed light colours — the menu is a branded dark-forest overlay, identical in
// light and dark mode (matches the login brand panel).
const LIGHT = '#f3efe4'
const MUTED = 'rgba(243, 239, 228, 0.6)'
const FAINT = 'rgba(243, 239, 228, 0.18)'

// Small ghost-pill used for account actions (classes so :hover works on a
// fixed-colour overlay).
const ghostPill =
  'inline-flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.16em] rounded-lg px-3.5 py-2 ' +
  'border border-[rgba(243,239,228,0.2)] text-[rgba(243,239,228,0.72)] ' +
  'hover:border-[#e6b23e] hover:text-[#e6b23e] transition-colors no-underline'

const chapters = [
  { to: '/recipes', label: 'Recipes', numeral: 'I' },
  { to: '/suggestions', label: 'Ideas', numeral: 'II' },
  { to: '/promos', label: 'Promos', numeral: 'III' },
  { to: '/shopping-cart', label: 'Cart', numeral: 'IV' },
  { to: '/settings', label: 'Settings', numeral: 'V' },
  // Meal planning now lives on the home page; Pantry is hidden until it works.
  // Theme + member management live inside Settings.
]

type AppMenuProps = {
  open: boolean
  onClose: () => void
}

export function AppMenu({ open, onClose }: AppMenuProps) {
  const { user, logout } = useAuth()
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
          transition={{ duration: 0.28, ease }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden"
          style={{
            color: LIGHT,
            background:
              'radial-gradient(70% 55% at 100% 0%, rgba(47,125,79,0.5), transparent 55%),' +
              'radial-gradient(60% 55% at 0% 100%, rgba(224,165,46,0.18), transparent 55%),' +
              'linear-gradient(155deg, #213b2b 0%, #15231a 100%)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
        >
          {/* decorative sprig, clipped so it never adds scroll */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <span
              className="absolute -right-12 -bottom-24 select-none leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18rem, 38vw, 36rem)', fontWeight: 800, color: 'rgba(243,239,228,0.04)' }}
            >
              ❧
            </span>
          </div>

          {/* Header — matches the Layout header geometry exactly so the logo
              doesn't move on open, it just recolours. */}
          <header className="relative px-5 sm:px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between gap-4 shrink-0">
            <Link to="/" onClick={onClose} className="flex items-center gap-2.5 no-underline" style={{ color: LIGHT }}>
              <Logo size={26} />
              <span className="font-display leading-none" style={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
                Cookmate
              </span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="font-mono text-[0.72rem] uppercase tracking-[0.2em] flex items-center gap-3 text-[rgba(243,239,228,0.62)] hover:text-[#e6b23e] transition-colors"
            >
              <span>Close</span>
              <span aria-hidden className="text-base leading-none">×</span>
            </button>
          </header>

          {/* Chapters */}
          <nav className="relative px-6 md:px-12 lg:px-20 flex-1 min-h-0 flex flex-col justify-center py-6">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] mb-5 text-[#e6b23e]">Inside the kitchen</p>

            <ul className="space-y-1">
              {chapters.map((c, i) => {
                const active = location.pathname.startsWith(c.to)
                return (
                  <motion.li
                    key={c.to}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.08, duration: 0.5, ease }}
                  >
                    <NavLink
                      to={c.to}
                      onClick={onClose}
                      className="group grid grid-cols-[2rem_1fr] gap-x-4 md:gap-x-6 items-baseline no-underline py-1.5"
                    >
                      <span className="num text-right text-sm pt-2" style={{ color: active ? '#e6b23e' : MUTED }}>
                        {c.numeral}
                      </span>
                      <span
                        className={[
                          'font-display flex items-baseline gap-4 transition-colors',
                          active ? 'text-[#e6b23e]' : 'text-[#f3efe4] group-hover:text-[#e6b23e]',
                        ].join(' ')}
                        style={{ fontSize: 'clamp(2.2rem, 6vw, 4.5rem)', lineHeight: 0.98, fontWeight: 800, letterSpacing: '-0.035em' }}
                      >
                        {c.label}
                        <span
                          aria-hidden
                          className="opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[0.42em] text-[#e6b23e]"
                        >
                          →
                        </span>
                      </span>
                    </NavLink>
                  </motion.li>
                )
              })}
            </ul>
          </nav>

          {/* Footer: theme + account */}
          <motion.footer
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5, ease }}
            className="relative px-6 md:px-12 lg:px-20 pb-8 pt-5 shrink-0 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
            style={{ borderTop: `1px solid ${FAINT}` }}
          >
            {/* account */}
            <div className="min-w-0">
              {user ? (
                <>
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] mb-1" style={{ color: MUTED }}>
                    Signed in as
                  </p>
                  <p className="text-lg truncate max-w-full sm:max-w-[34vw]" style={{ color: LIGHT, fontFamily: 'var(--font-body)' }}>
                    {user.email}
                  </p>
                </>
              ) : (
                <Link to="/login" onClick={onClose} className={ghostPill}>
                  Sign in →
                </Link>
              )}
            </div>

            {/* account actions — theme + member management now live in Settings */}
            {user && (
              <div className="sm:flex sm:items-end">
                <button type="button" onClick={handleLogout} className={`${ghostPill} justify-center w-full sm:w-auto`}>
                  Sign out
                </button>
              </div>
            )}
          </motion.footer>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

