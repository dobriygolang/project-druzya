import { Link } from 'react-router-dom'
import { LandingDownloadButton } from '@/components/landing/LandingDownloadButton'
import { useI18n } from '@/lib/i18n'

export function LandingNav() {
  const { t } = useI18n()

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-transparent bg-transparent py-6 transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <Link
          to="/welcome"
          className="flex items-center gap-2 no-underline transition-opacity hover:opacity-80"
          aria-label="Hone home"
        >
          <span className="text-xl font-bold tracking-tight text-white">HONE</span>
          <span className="rounded border border-winter-border bg-winter-card px-1.5 py-0.5 font-mono text-[10px] text-winter-muted">
            v{t('welcome.version')}
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#manifesto"
            className="text-sm text-winter-muted transition-colors hover:text-white"
          >
            {t('welcome.navPhilosophy')}
          </a>
          <div className="h-4 w-px bg-winter-border" />
          <LandingDownloadButton compact />
        </div>
      </div>
    </nav>
  )
}
