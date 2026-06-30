import { Link } from 'react-router-dom'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Logo } from '@/components/brand/Logo'
import { SiteThemeToggle } from '@/components/brand/SiteThemeToggle'
import { LandingDownloadButton } from '@/components/landing/LandingDownloadButton'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'
import { hasValidAccessToken } from '@/lib/apiClient'

export function LandingNav() {
  const { t } = useI18n()
  const { theme, toggleTheme } = useSiteTheme()
  const isAuthed = hasValidAccessToken()
  const logoTone = theme === 'dark' ? 'dark' : 'light'
  const linkClass = 'text-sm text-site-muted no-underline transition-colors hover:text-site-text'

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-transparent bg-transparent py-5 transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <Link
          to="/welcome"
          className="flex items-center gap-2.5 no-underline transition-opacity hover:opacity-80"
          aria-label="Hone home"
        >
          <Logo tone={logoTone} className="pointer-events-none" />
          <span className="rounded border border-site-border bg-site-card px-1.5 py-0.5 font-mono text-[10px] text-site-muted">
            v{t('welcome.version')}
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <a href="#manifesto" className={linkClass}>
            {t('welcome.navPhilosophy')}
          </a>
          <Link to="/live/new" className={linkClass}>
            {t('public.liveCoding')}
          </Link>
          <Link to="/pricing" className={linkClass}>
            {t('public.pricing')}
          </Link>
          <div className="h-4 w-px bg-site-border" />
          <LocaleSwitcher compact />
          <SiteThemeToggle theme={theme} onToggle={toggleTheme} compact />
          <LandingDownloadButton compact />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <SiteThemeToggle theme={theme} onToggle={toggleTheme} compact />
          {isAuthed ? (
            <Link to="/profile" className={cn(linkClass, 'text-xs')}>
              {t('public.account')}
            </Link>
          ) : (
            <LandingDownloadButton compact />
          )}
        </div>
      </div>
    </nav>
  )
}
