import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { useI18n } from '@/lib/i18n'

export function LandingFooter() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto flex max-w-[920px] flex-wrap items-end justify-between gap-6 px-6 py-12 sm:px-8">
        <div className="max-w-[420px]">
          <Logo to="/welcome" size="sm" tone="light" />
          <p className="mt-3.5 text-[13.5px] leading-relaxed text-text-secondary">{t('welcome.footerTagline')}</p>
          <div className="mt-4 text-[12.5px] text-text-muted">© {year} Hone</div>
        </div>
        <div className="flex flex-wrap gap-6 text-[13.5px] text-text-secondary">
          <Link to="/legal/terms" className="no-underline hover:text-text-primary">
            {t('public.terms')}
          </Link>
          <Link to="/legal/privacy" className="no-underline hover:text-text-primary">
            {t('public.privacy')}
          </Link>
          <Link to="/live/new" className="no-underline hover:text-text-primary">
            {t('public.liveCoding')}
          </Link>
          <Link to="/pricing" className="no-underline hover:text-text-primary">
            {t('public.pricing')}
          </Link>
        </div>
      </div>
    </footer>
  )
}
