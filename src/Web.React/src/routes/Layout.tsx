import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from '@/components/Logo'
import { AppMenu } from '@/components/AppMenu'
import { useAuth } from '@/auth/AuthContext'

export default function Layout() {
  const { user } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // The calendar is a full-height, scroll-free view — drop the page footer so it
  // fits the viewport exactly instead of being pushed just below the fold.
  const fullHeight = location.pathname === '/calendar'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 px-5 sm:px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between gap-4 border-b border-cream-shadow bg-cream/80 backdrop-blur-md">
        <NavLink to="/" className="flex items-center gap-2.5 text-paprika no-underline">
          <Logo size={26} />
          <span
            className="font-display text-[1.4rem] text-ink leading-none"
            style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            Cookmate
          </span>
          <span aria-hidden className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-paprika translate-y-[1px]" />
        </NavLink>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className="group flex items-center gap-3 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-chestnut hover:text-paprika transition-colors"
        >
          {user && (
            <span
              className="hidden sm:inline-block w-2 h-2 rounded-full bg-paprika"
              aria-hidden
              title={user.email}
            />
          )}
          <span className="hidden sm:inline">Menu</span>
          <MenuGlyph />
        </button>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {!fullHeight && <Footer />}

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}

// The colophon — back-matter of the cookbook. A warm hairline, the wordmark with
// a serif aside, two quiet link columns, and an edition line wrapped around the ❧.
function Footer() {
  const year = new Date().getFullYear()
  const link = 'text-ink-soft hover:text-paprika transition-colors no-underline'

  return (
    <footer className="mt-24">
      {/* Warm gradient hairline instead of a flat rule — the page's bottom edge. */}
      <div className="h-px rule-warm" aria-hidden />

      <div className="px-5 sm:px-6 md:px-12 lg:px-20 py-14 md:py-16">
        <div className="grid gap-10 md:gap-8 md:grid-cols-[1.7fr_1fr_1fr]">
          {/* Brand + tagline */}
          <div className="max-w-xs">
            <Link to="/" className="inline-flex items-center gap-2.5 text-paprika no-underline">
              <Logo size={24} />
              <span className="font-display text-[1.3rem] text-ink leading-none" style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Cookmate
              </span>
            </Link>
            <p className="mt-4 text-ink-soft leading-relaxed" style={{ fontFamily: 'var(--font-body)', fontSize: '1.05rem' }}>
              A kitchen worth <span className="italic text-butter-deep">coming back to.</span>
            </p>
          </div>

          {/* Kitchen */}
          <nav aria-label="Kitchen">
            <p className="eyebrow mb-4">Kitchen</p>
            <ul className="space-y-2.5 text-[0.98rem]">
              <li><Link to="/recipes" className={link}>Recipes</Link></li>
              <li><Link to="/suggestions" className={link}>Ideas</Link></li>
              <li><Link to="/shop" className={link}>Shop</Link></li>
              <li><Link to="/calendar" className={link}>Calendar</Link></li>
            </ul>
          </nav>

          {/* Make */}
          <nav aria-label="Make">
            <p className="eyebrow mb-4">Make</p>
            <ul className="space-y-2.5 text-[0.98rem]">
              <li><Link to="/recipes/new" className={link}>Add a recipe</Link></li>
              <li><Link to="/settings" className={link}>Settings</Link></li>
            </ul>
          </nav>
        </div>

        {/* Colophon */}
        <div className="mt-12 md:mt-14 pt-6 border-t border-cream-shadow grid grid-cols-1 sm:grid-cols-3 items-center gap-3 text-center">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-chestnut sm:text-left">
            Cookmate <span className="text-chestnut-soft">·</span> Vol. 01
          </span>
          <span aria-hidden className="font-display text-paprika/35 text-2xl leading-none select-none">
            ❧
          </span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-chestnut-soft sm:text-right">
            Personal cookbook <span className="text-chestnut-soft/60">·</span> Belgium <span className="text-chestnut-soft/60">·</span> {year}
          </span>
        </div>
      </div>
    </footer>
  )
}

function MenuGlyph() {
  return (
    <span className="flex flex-col gap-[5px]" aria-hidden>
      <span className="block w-6 h-px bg-current transition-transform group-hover:scale-x-110 origin-right" />
      <span className="block w-4 h-px bg-current ml-auto transition-transform group-hover:scale-x-110 origin-right" />
    </span>
  )
}
