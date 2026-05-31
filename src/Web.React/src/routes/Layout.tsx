import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
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

      <footer className="px-5 sm:px-6 md:px-12 lg:px-20 py-10 mt-20 border-t border-cream-shadow">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-chestnut">
            Cookmate &middot; Vol. 01
          </span>
          <span className="font-mono text-[0.66rem] tracking-tight text-chestnut-soft">
            Personal cookbook · Belgium
          </span>
        </div>
      </footer>

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
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
