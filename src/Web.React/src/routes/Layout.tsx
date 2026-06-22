import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Logo } from '@/components/Logo'
import { AppMenu } from '@/components/AppMenu'
import { useAuth } from '@/auth/AuthContext'

export default function Layout() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

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

      <Footer />

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}

// The colophon — back-matter of the cookbook, set on a deep-forest panel (the same
// branded surface as the kitchen menu) so it reads as a distinct close to the page.
// Fixed light-on-dark colours, identical in both themes — like AppMenu.
function Footer() {
  const year = new Date().getFullYear()
  const link = 'no-underline transition-colors text-[rgba(243,239,228,0.82)] hover:text-[#e6b23e]'
  const heading = 'font-mono text-[0.62rem] uppercase tracking-[0.24em] mb-4 text-[#e6b23e]'

  return (
    <footer
      className="relative overflow-hidden mt-24 text-[#f3efe4]"
      style={{
        background:
          'radial-gradient(60% 65% at 100% 0%, rgba(47,125,79,0.40), transparent 58%),' +
          'radial-gradient(55% 60% at 0% 100%, rgba(224,165,46,0.16), transparent 55%),' +
          'linear-gradient(155deg, #213b2b 0%, #15231a 100%)',
      }}
    >
      {/* Gold hairline marking the seam between the cream page and the forest panel. */}
      <div
        className="h-px"
        aria-hidden
        style={{ background: 'linear-gradient(to right, transparent, rgba(230,178,62,0.55), transparent)' }}
      />

      {/* Oversized sprig, clipped into the corner for atmosphere (echoes the menu). */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -bottom-24 select-none leading-none"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(13rem, 26vw, 24rem)', fontWeight: 800, color: 'rgba(243,239,228,0.045)' }}
      >
        ❧
      </span>

      <div className="relative px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
        <div className="grid gap-12 md:gap-8 md:grid-cols-[1.7fr_1fr_1fr]">
          {/* Brand + tagline */}
          <div className="max-w-xs">
            <Link to="/" className="inline-flex items-center gap-2.5 no-underline" style={{ color: '#f3efe4' }}>
              <Logo size={26} />
              <span className="font-display text-[1.4rem] leading-none" style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Cookmate
              </span>
            </Link>
            <p className="mt-4 leading-relaxed" style={{ fontFamily: 'var(--font-body)', fontSize: '1.08rem', color: 'rgba(243,239,228,0.78)' }}>
              A kitchen worth <span className="italic" style={{ color: '#e6b23e' }}>coming back to.</span>
            </p>
          </div>

          {/* Kitchen */}
          <nav aria-label="Kitchen">
            <p className={heading}>Kitchen</p>
            <ul className="space-y-2.5 text-[0.98rem]">
              <li><Link to="/recipes" className={link}>Recipes</Link></li>
              <li><Link to="/suggestions" className={link}>Ideas</Link></li>
              <li><Link to="/shop" className={link}>Shop</Link></li>
              <li><Link to="/calendar" className={link}>Calendar</Link></li>
            </ul>
          </nav>

          {/* Make */}
          <nav aria-label="Make">
            <p className={heading}>Make</p>
            <ul className="space-y-2.5 text-[0.98rem]">
              <li><Link to="/recipes/new" className={link}>Add a recipe</Link></li>
              <li><Link to="/settings" className={link}>Settings</Link></li>
            </ul>
          </nav>
        </div>

        {/* Colophon */}
        <div
          className="mt-14 md:mt-16 pt-6 grid grid-cols-1 sm:grid-cols-3 items-center gap-3 text-center"
          style={{ borderTop: '1px solid rgba(243,239,228,0.16)' }}
        >
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] sm:text-left" style={{ color: 'rgba(243,239,228,0.62)' }}>
            Cookmate <span style={{ color: 'rgba(243,239,228,0.3)' }}>·</span> Vol. 01
          </span>
          <span aria-hidden className="font-display text-2xl leading-none select-none" style={{ color: 'rgba(230,178,62,0.6)' }}>
            ❧
          </span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] sm:text-right" style={{ color: 'rgba(243,239,228,0.45)' }}>
            Personal cookbook <span style={{ color: 'rgba(243,239,228,0.25)' }}>·</span> Belgium{' '}
            <span style={{ color: 'rgba(243,239,228,0.25)' }}>·</span> {year}
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
