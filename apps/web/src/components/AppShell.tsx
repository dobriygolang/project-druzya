import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, CreditCard, Info, LogOut, User } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { PAGE_MAX_WIDTH_CLASS } from '@/lib/brand/layout'
import { UserAvatar } from '@/components/UserAvatar'
import { getMe, logout } from '@/lib/api/auth'
import { cn } from '@/lib/cn'
import { useMotion } from '@/lib/motion-presets'
import { useI18n } from '@/lib/i18n'
import { useRef, useState } from 'react'

const IMMERSIVE: RegExp[] = [/^\/live\//]

function UserMenu({ onClose }: { onClose: () => void }) {
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
  const { t } = useI18n()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
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
        <Logo to="/welcome" size="sm" />

        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher compact className="hidden sm:flex" />
          <div ref={userMenuRef} className="relative">
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
            {userMenuOpen ? <UserMenu onClose={() => setUserMenuOpen(false)} /> : null}
          </div>
        </div>
      </div>
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
          className="focus:outline-none"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
