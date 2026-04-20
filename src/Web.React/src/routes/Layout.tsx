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
      <header className="px-6 md:px-12 lg:px-20 pt-6 pb-5 flex items-baseline justify-between gap-4">
        <NavLink
          to="/"
          className="flex items-baseline gap-3 text-paprika no-underline"
        >
          <Logo size={26} className="translate-y-1" />
          <span className="font-display text-[1.5rem] tracking-tight text-ink leading-none">
            Cookmate
          </span>
        </NavLink>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className="group flex items-center gap-3 font-mono text-[0.78rem] uppercase tracking-[0.22em] text-chestnut hover:text-paprika transition-colors"
        >
          {user && (
            <span
              className="hidden sm:inline-block w-2 h-2 rounded-full bg-paprika"
              aria-hidden
              title={user.email}
            />
          )}
          <MenuGlyph />
          <span className="hidden sm:inline">Menu</span>
        </button>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="px-6 md:px-12 lg:px-20 py-10 mt-16 border-t border-cream-shadow">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-chestnut">
            Cookmate &middot; Vol. 01
          </span>
          <span className="font-mono text-[0.7rem] tracking-tight text-chestnut-soft">
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
