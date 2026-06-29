import { Link } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'

export function LandingFooter() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-winter-border bg-winter-bg py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center justify-between gap-4 font-mono text-xs text-winter-muted md:flex-row">
          <div className="text-center md:text-left">{t('welcome.footerCopyright', { year })}</div>
          <div className="flex gap-6">
            <Link to="/legal/privacy" className="no-underline transition-colors hover:text-white">
              {t('public.privacy')}
            </Link>
            <Link to="/legal/terms" className="no-underline transition-colors hover:text-white">
              {t('public.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
