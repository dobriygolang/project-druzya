import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, CreditCard, Info, LogOut, User } from 'lucide-react'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Logo } from '@/components/brand/Logo'
import { SiteThemeToggle } from '@/components/brand/SiteThemeToggle'
import { LandingDownloadButton } from '@/components/landing/LandingDownloadButton'
import { UserAvatar } from '@/components/UserAvatar'
import { getMe, logout } from '@/lib/api/auth'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'
import { hasValidAccessToken } from '@/lib/apiClient'

type LinkItem = { href: string; label: string; external?: boolean }

type SiteHeaderProps = {
  centerLinks?: LinkItem[]
  right?: ReactNode
  className?: string
}

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
      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-site-border bg-site-card p-1.5 shadow-lg"
      role="menu"
    >
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-site-text no-underline transition-colors hover:bg-site-surface"
          role="menuitem"
        >
          <it.icon className="h-4 w-4 shrink-0 text-site-muted" />
          <span className="truncate">{it.label}</span>
        </Link>
      ))}
      <div className="my-1 border-t border-site-border" />
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-site-text transition-colors hover:bg-site-surface"
        role="menuitem"
      >
        <LogOut className="h-4 w-4 shrink-0 text-site-muted" />
        <span>{t('shell.logout')}</span>
      </button>
    </div>
  )
}

function AuthedAccountMenu() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const username = meQ.data?.username ?? t('shell.accountFallback')

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-site-border bg-site-card px-2 py-1.5',
          'text-sm font-medium text-site-text transition-colors hover:border-site-muted hover:bg-site-surface',
        )}
        aria-label={t('shell.accountMenu')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-7 w-7 overflow-hidden rounded-full bg-site-surface">
          <UserAvatar
            name={username}
            avatarUrl={meQ.data?.avatar_url}
            className="h-7 w-7"
            textClassName="text-[11px]"
          />
        </span>
        <span className="hidden max-w-[120px] truncate sm:inline">{username}</span>
        <ChevronDown className={cn('h-4 w-4 text-site-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <UserMenu onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

export function SiteHeader({ centerLinks, right, className }: SiteHeaderProps) {
  const { t } = useI18n()
  const { theme, toggleTheme } = useSiteTheme()
  const isAuthed = hasValidAccessToken()

  const defaultCenter: LinkItem[] = [
    { href: '/welcome#manifesto', label: t('welcome.navPhilosophy') },
    { href: '/live/new', label: t('public.liveCoding') },
    { href: '/pricing', label: t('public.pricing') },
  ]

  const links = centerLinks ?? defaultCenter
  const linkClass = 'text-sm text-site-muted no-underline transition-colors hover:text-site-text'

  const defaultRight = (
    <>
      <LocaleSwitcher compact className="hidden sm:flex" />
      <SiteThemeToggle theme={theme} onToggle={toggleTheme} compact className="hidden sm:inline-flex" />
      <LandingDownloadButton compact className="hidden sm:inline-flex" />
      {isAuthed ? (
        <AuthedAccountMenu />
      ) : (
        <Link
          to="/login"
          className="rounded-md bg-site-accent px-3.5 py-2 text-sm font-medium text-site-accent-fg no-underline transition-opacity hover:opacity-90"
        >
          {t('public.startFree')}
        </Link>
      )}
    </>
  )

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-site-border/60 bg-site-bg/80 backdrop-blur-md',
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Logo to="/welcome" />

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((item) =>
            item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {item.label}
              </a>
            ) : item.href.includes('#') ? (
              <a key={item.href} href={item.href} className={linkClass}>
                {item.label}
              </a>
            ) : (
              <Link key={item.href} to={item.href} className={linkClass}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <SiteThemeToggle theme={theme} onToggle={toggleTheme} compact className="sm:hidden" />
          {right ?? defaultRight}
        </div>
      </div>
    </header>
  )
}
