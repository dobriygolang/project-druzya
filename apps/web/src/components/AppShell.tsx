import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Menu, User, X } from 'lucide-react'
import { getMe, logout } from '@/lib/api/auth'
import { cn } from '@/lib/cn'
import { MobileBottomNav } from '@/components/MobileBottomNav'

const NAV = [
  { to: '/dashboard', label: 'Главная' },
  { to: '/interview', label: 'Mock' },
] as const

const IMMERSIVE: RegExp[] = [/^\/interview\/session\//, /^\/live\//]

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border-strong bg-surface-2 font-display text-lg font-extrabold text-text-primary">
        9
      </span>
      <span className="font-display text-lg font-bold text-text-primary">druz9</span>
    </Link>
  )
}

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'block rounded-md px-3.5 py-2 text-sm transition-colors',
          isActive
            ? 'bg-surface-2 font-semibold text-text-primary'
            : 'font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary',
        )
      }
    >
      {label}
    </NavLink>
  )
}

function UserMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    onClose()
    navigate('/welcome', { replace: true })
  }

  return (
    <div
      className="absolute right-0 top-full z-50 mt-2 flex w-56 flex-col rounded-lg border border-border bg-surface-1 p-1.5 shadow-card"
      role="menu"
    >
      <Link
        to="/profile"
        onClick={onClose}
        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        role="menuitem"
      >
        <User className="h-4 w-4 shrink-0" />
        Профиль
      </Link>
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        role="menuitem"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Выйти
      </button>
    </div>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full border border-border-strong bg-surface-2 text-sm font-semibold text-text-primary">
      {initials.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const immersive = IMMERSIVE.some((re) => re.test(location.pathname))
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('v2')
    return () => document.body.classList.remove('v2')
  }, [])

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!userMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userMenuOpen])

  const initials = meQ.data?.username?.slice(0, 1) ?? 'D'

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-bg px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <div className="flex min-w-0 items-center gap-4 lg:gap-8">
          <Logo />
          {!immersive ? (
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="rounded-full transition hover:ring-2 hover:ring-text-primary/20"
              aria-label="Меню пользователя"
              aria-expanded={userMenuOpen}
            >
              <Avatar initials={initials} />
            </button>
            {userMenuOpen ? <UserMenu onClose={() => setUserMenuOpen(false)} /> : null}
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-md text-text-secondary hover:bg-surface-2 lg:hidden"
            aria-label="Меню"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[280px] flex-col gap-2 border-l border-border bg-surface-1 p-4">
            <div className="mb-2 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-md text-text-secondary hover:bg-surface-2"
                aria-label="Закрыть"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavItem key={item.to} {...item} onClick={() => setMenuOpen(false)} />
              ))}
              <div className="my-2 border-t border-border" />
              <NavItem to="/profile" label="Профиль" onClick={() => setMenuOpen(false)} />
            </nav>
          </div>
        </div>
      ) : null}

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'focus:outline-none',
          immersive
            ? 'pb-0'
            : 'pb-[calc(72px+env(safe-area-inset-bottom,0px))] sm:pb-0',
        )}
      >
        {children}
      </main>

      <MobileBottomNav />
    </div>
  )
}
