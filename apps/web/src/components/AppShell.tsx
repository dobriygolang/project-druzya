import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, CreditCard, HelpCircle, LogOut, Menu, User, X } from 'lucide-react'
import { getMe, logout } from '@/lib/api/auth'
import { cn } from '@/lib/cn'
import { PRIMARY_NAV } from '@/lib/migration/nav'
import { useMotion } from '@/lib/motion-presets'
import { MobileBottomNav } from '@/components/MobileBottomNav'

const IMMERSIVE: RegExp[] = [/^\/interview\/session\//, /^\/live\//]

function Logo() {
  return (
    <Link to="/today" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border-strong bg-surface-2 font-display text-lg font-extrabold text-text-primary">
        9
      </span>
      <span className="font-display text-lg font-bold text-text-primary">druz9</span>
    </Link>
  )
}

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  const active = pathname === to || pathname.startsWith(`${to}/`)
  return (
    <motion.div
      whileHover={reduced ? undefined : { scale: 1.02 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
    >
      <Link
        to={to}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'block rounded-md px-3.5 py-2 text-sm transition-colors',
          active
            ? 'bg-surface-2 font-semibold text-text-primary'
            : 'font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary',
        )}
      >
        {label}
      </Link>
    </motion.div>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full border border-border-strong bg-surface-2 text-sm font-semibold text-text-primary">
      {initials.slice(0, 1).toUpperCase()}
    </span>
  )
}

function UserMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    onClose()
    navigate('/welcome', { replace: true })
  }

  const items = [
    { to: '/profile', label: 'Профиль', icon: User },
    { to: '/pricing', label: 'Тарифы', icon: CreditCard },
    { to: '/welcome', label: 'О продукте', icon: HelpCircle },
  ]

  return (
    <div
      className="absolute right-0 top-full z-50 mt-2 flex w-56 flex-col rounded-lg border border-border bg-surface-1 p-1.5 shadow-card"
      role="menu"
    >
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          role="menuitem"
        >
          <it.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{it.label}</span>
        </Link>
      ))}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        role="menuitem"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>Log out</span>
      </button>
    </div>
  )
}

function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const initials = meQ.data?.username?.slice(0, 1) ?? 'D'

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

  return (
    <header className="sticky top-0 z-40 flex h-[64px] items-center justify-between border-b border-border bg-bg px-4 sm:px-6 lg:h-[72px] lg:px-8">
      <div className="flex min-w-0 items-center gap-4 lg:gap-8">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.to} to={item.to} label={item.label} />
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md text-text-secondary hover:bg-surface-2"
          aria-label="Notifications"
          disabled
          title="Уведомления — скоро"
        >
          <Bell className="h-5 w-5" />
        </button>
        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="rounded-full transition hover:ring-2 hover:ring-text-primary/20"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <Avatar initials={initials} />
          </button>
          {userMenuOpen ? <UserMenu onClose={() => setUserMenuOpen(false)} /> : null}
        </div>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md text-text-secondary hover:bg-surface-2 lg:hidden"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[280px] flex-col gap-2 border-l border-border bg-surface-1 p-4">
            <div className="mb-2 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-md text-text-secondary hover:bg-surface-2"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {PRIMARY_NAV.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  onClick={() => setMenuOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const immersive = IMMERSIVE.some((re) => re.test(location.pathname))
  const motionProps = useMotion('pageTransition')

  useEffect(() => {
    document.body.classList.add('v2')
    return () => document.body.classList.remove('v2')
  }, [])

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [location.pathname, location.hash])

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {!immersive ? <TopNav /> : null}
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          id="main"
          tabIndex={-1}
          {...motionProps}
          style={
            immersive
              ? undefined
              : { paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }
          }
          className={cn('focus:outline-none', immersive ? 'pb-0' : 'sm:!pb-0')}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      {!immersive ? <MobileBottomNav /> : null}
    </div>
  )
}
