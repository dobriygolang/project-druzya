import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, CreditCard, Info, LogOut, Menu, Shield, User, X } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { PAGE_MAX_WIDTH_CLASS } from '@/lib/brand/layout'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { UserAvatar } from '@/components/UserAvatar'
import { getMe, logout } from '@/lib/api/auth'
import { cn } from '@/lib/cn'
import { usePrimaryNav } from '@/lib/migration/nav'
import { useMotion } from '@/lib/motion-presets'
import { useI18n } from '@/lib/i18n'
import { useIsAdmin } from '@/hooks/useIsAdmin'

const IMMERSIVE: RegExp[] = [/^\/interview\/session\//, /^\/live\//]

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  const { pathname } = useLocation()
  const active = pathname === to || pathname.startsWith(`${to}/`)
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm no-underline transition-colors',
        active
          ? 'border-border-strong bg-surface-2 font-medium text-text-primary'
          : 'border-transparent font-normal text-text-secondary hover:border-border hover:bg-surface-1 hover:text-text-primary',
      )}
    >
      {label}
    </Link>
  )
}

function ShellDrawerLink({
  to,
  icon: Icon,
  children,
  onClick,
}: {
  to: string
  icon: typeof User
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-sm text-text-primary no-underline hover:bg-surface-2"
    >
      <Icon className="h-4 w-4 shrink-0 text-text-muted" />
      {children}
    </Link>
  )
}

function UserMenu({ onClose, isAdmin }: { onClose: () => void; isAdmin: boolean }) {
  const navigate = useNavigate()
  const { t } = useI18n()

  async function handleLogout() {
    await logout()
    onClose()
    navigate('/welcome', { replace: true })
  }

  const items = [
    { to: '/profile', label: t('shell.profile'), icon: User },
    { to: '/pricing', label: t('shell.pricing'), icon: CreditCard },
    { to: '/welcome', label: t('shell.about'), icon: Info },
    ...(isAdmin ? [{ to: '/admin', label: t('shell.admin'), icon: Shield }] : []),
  ]

  return (
    <div
      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-surface-1 p-1.5 shadow-lg"
      role="menu"
    >
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary no-underline transition-colors hover:bg-surface-2"
          role="menuitem"
        >
          <it.icon className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="truncate">{it.label}</span>
        </Link>
      ))}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-2"
        role="menuitem"
      >
        <LogOut className="h-4 w-4 shrink-0 text-text-muted" />
        <span>{t('shell.logout')}</span>
      </button>
    </div>
  )
}

function TopNav() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const primaryNav = usePrimaryNav()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const { isAdmin } = useIsAdmin()
  const username = meQ.data?.username ?? t('shell.accountFallback')

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
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/90">
      <div
        className={cn(
          'mx-auto flex h-16 items-center justify-between gap-4 px-6 sm:px-8',
          PAGE_MAX_WIDTH_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-4 lg:gap-8">
          <Logo to="/today" size="sm" />
          <nav className="hidden items-center gap-1 lg:flex">
            {primaryNav.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} />
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher compact className="hidden sm:flex" />
          <div ref={userMenuRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-2 py-1.5',
                'text-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-surface-2',
              )}
              aria-label={t('shell.accountMenu')}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
            >
              <span className="grid h-7 w-7 overflow-hidden rounded-full bg-surface-2">
                <UserAvatar
                  name={username}
                  avatarUrl={meQ.data?.avatar_url}
                  className="h-7 w-7"
                  textClassName="text-[11px]"
                />
              </span>
              <span className="max-w-[120px] truncate">{username}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-text-muted transition-transform',
                  userMenuOpen && 'rotate-180',
                )}
              />
            </button>
            {userMenuOpen ? <UserMenu onClose={() => setUserMenuOpen(false)} isAdmin={isAdmin} /> : null}
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface-1 text-text-secondary hover:bg-surface-2 lg:hidden"
            aria-label={t('shell.menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[280px] flex-col gap-2 border-l border-border bg-bg p-5">
            <div className="mb-2 flex items-center justify-between">
              <Logo to="/today" size="sm" />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border text-text-secondary hover:bg-surface-2"
                aria-label={t('shell.closeMenu')}
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {primaryNav.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  onClick={() => setMenuOpen(false)}
                />
              ))}
            </nav>
            <div className="mt-4 px-1">
              <LocaleSwitcher />
            </div>
            <div className="mt-auto space-y-1 border-t border-border pt-4">
              <ShellDrawerLink to="/profile" icon={User} onClick={() => setMenuOpen(false)}>
                {t('shell.profile')}
              </ShellDrawerLink>
              <ShellDrawerLink to="/pricing" icon={CreditCard} onClick={() => setMenuOpen(false)}>
                {t('shell.pricing')}
              </ShellDrawerLink>
              <ShellDrawerLink to="/welcome" icon={Info} onClick={() => setMenuOpen(false)}>
                {t('shell.about')}
              </ShellDrawerLink>
              {isAdmin ? (
                <ShellDrawerLink to="/admin" icon={Shield} onClick={() => setMenuOpen(false)}>
                  {t('shell.admin')}
                </ShellDrawerLink>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  void logout().then(() => navigate('/welcome', { replace: true }))
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2"
              >
                <LogOut className="h-4 w-4 shrink-0 text-text-muted" />
                {t('shell.logout')}
              </button>
            </div>
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
  const reduced = useReducedMotion()

  useEffect(() => {
    document.body.classList.add('v2')
    document.documentElement.classList.add('light')
    return () => {
      document.body.classList.remove('v2')
    }
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
          {...(reduced ? {} : motionProps)}
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
