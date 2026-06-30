import { Link } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'

export function LandingFooter() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-site-border bg-site-bg py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-4 font-mono text-xs text-site-muted md:flex-row">
          <div className="text-center md:text-left">{t('welcome.footerCopyright', { year })}</div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/live/new" className="no-underline transition-colors hover:text-site-text">
              {t('public.liveCoding')}
            </Link>
            <Link to="/pricing" className="no-underline transition-colors hover:text-site-text">
              {t('public.pricing')}
            </Link>
            <Link to="/legal/privacy" className="no-underline transition-colors hover:text-site-text">
              {t('public.privacy')}
            </Link>
            <Link to="/legal/terms" className="no-underline transition-colors hover:text-site-text">
              {t('public.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
