import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Logo } from '@/components/brand/Logo'
import { SiteThemeToggle } from '@/components/brand/SiteThemeToggle'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { SiteThemeShell, useSiteTheme } from '@/lib/site/useSiteTheme'
import { hasValidAccessToken } from '@/lib/apiClient'

type LinkItem = { href: string; label: string; external?: boolean }

type NavProps = {
  centerLinks?: LinkItem[]
  right?: ReactNode
  className?: string
  fixed?: boolean
}

export function PublicNav({ centerLinks, right, className, fixed }: NavProps) {
  const { t } = useI18n()
  const { theme, toggleTheme } = useSiteTheme()
  const isAuthed = hasValidAccessToken()
  const logoTone = theme === 'dark' ? 'dark' : 'light'

  const defaultCenter: LinkItem[] = [
    { href: '/welcome#manifesto', label: t('welcome.navPhilosophy') },
    { href: '/live/new', label: t('public.liveCoding') },
    { href: '/pricing', label: t('public.pricing') },
  ]

  const links = centerLinks ?? defaultCenter
  const linkClass =
    'text-sm text-site-muted no-underline transition-colors hover:text-site-text'

  return (
    <header
      className={cn(
        'z-50 border-b border-site-border/60 bg-site-bg/80 backdrop-blur-md',
        fixed ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Logo to="/welcome" tone={logoTone} />

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
          <LocaleSwitcher compact className="hidden sm:flex" />
          <SiteThemeToggle theme={theme} onToggle={toggleTheme} compact className="hidden sm:inline-flex" />
          {right ??
            (isAuthed ? (
              <Link
                to="/profile"
                className="rounded-md bg-site-accent px-3.5 py-2 text-sm font-medium text-site-accent-fg no-underline transition-opacity hover:opacity-90"
              >
                {t('public.account')}
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-site-accent px-3.5 py-2 text-sm font-medium text-site-accent-fg no-underline transition-opacity hover:opacity-90"
              >
                {t('public.startFree')}
              </Link>
            ))}
        </div>
      </div>
    </header>
  )
}

export function PublicPageShell({ children }: { children: ReactNode }) {
  const { theme } = useSiteTheme()

  return (
    <SiteThemeShell
      theme={theme}
      className="min-h-screen bg-site-bg font-sans text-site-text selection:bg-site-accent/20 selection:text-site-text"
    >
      {children}
    </SiteThemeShell>
  )
}
