import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { SiteThemeToggle } from '@/components/brand/SiteThemeToggle'
import { SiteLocaleToggle } from '@/components/brand/SiteLocaleToggle'
import { LandingDownloadButton } from '@/components/landing/LandingDownloadButton'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'

type LinkItem = { href: string; label: string; external?: boolean }

type SiteHeaderProps = {
  centerLinks?: LinkItem[]
  right?: ReactNode
  className?: string
}

export function SiteHeader({ centerLinks, right, className }: SiteHeaderProps) {
  const { t } = useI18n()
  const { theme, toggleTheme } = useSiteTheme()

  const defaultCenter: LinkItem[] = [
    { href: '/welcome#manifesto', label: t('welcome.navPhilosophy') },
    { href: '/live/new', label: t('public.liveCoding') },
    { href: '/pricing', label: t('public.pricing') },
  ]

  const links = centerLinks ?? defaultCenter
  const linkClass = 'text-sm text-site-muted no-underline transition-colors hover:text-site-text'

  const defaultRight = (
    <>
      <SiteLocaleToggle compact className="hidden sm:inline-flex" />
      <SiteThemeToggle theme={theme} onToggle={toggleTheme} compact className="hidden sm:inline-flex" />
      <LandingDownloadButton compact />
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
          <SiteLocaleToggle compact className="sm:hidden" />
          <SiteThemeToggle theme={theme} onToggle={toggleTheme} compact className="sm:hidden" />
          {right ?? defaultRight}
        </div>
      </div>
    </header>
  )
}
