import { Link } from 'react-router-dom'
import { LandingHeroMedia } from '@/components/landing/LandingHeroMedia'
import { LandingDownloadButton } from '@/components/landing/LandingDownloadButton'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'

export function LandingHero() {
  const { t } = useI18n()
  const { theme } = useSiteTheme()
  const isDark = theme === 'dark'

  return (
    <section className="relative overflow-hidden pb-20 pt-28 md:pb-32 md:pt-44">
      <div className="pointer-events-none absolute right-0 top-0 z-0 h-full w-full opacity-20">
        <div
          className={cn(
            'absolute right-[-10%] top-[10%] h-[800px] w-[800px] rounded-full blur-[150px]',
            isDark ? 'bg-white opacity-5' : 'bg-site-glow opacity-[0.08]',
          )}
          style={isDark ? undefined : { backgroundColor: 'rgb(var(--site-glow))' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <div className="mb-8 inline-flex animate-[fadeInUp_0.8s_ease-out_forwards] items-center gap-2 rounded-full border border-site-border bg-site-card px-3 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="font-mono text-xs text-site-muted">{t('welcome.pill')}</span>
          </div>

          <h1 className="mb-8 animate-[fadeInUp_0.8s_ease-out_0.1s_forwards] text-5xl font-bold leading-[1.1] tracking-tight text-site-text opacity-0 md:text-7xl">
            {t('welcome.heroLine1')}{' '}
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, rgb(var(--site-text)), rgb(var(--site-hero-gradient-to)))`,
              }}
            >
              {t('welcome.heroLine2')}
              <br />
              {t('welcome.heroLine3')}
            </span>
          </h1>

          <p className="mb-10 max-w-xl animate-[fadeInUp_0.8s_ease-out_0.2s_forwards] text-lg leading-relaxed text-site-muted opacity-0 md:text-xl">
            {t('welcome.heroBody')}
          </p>

          <div className="flex animate-[fadeInUp_0.8s_ease-out_0.3s_forwards] flex-col gap-4 opacity-0 sm:flex-row sm:items-center">
            <LandingDownloadButton />
            <Link
              to="/live/new"
              className="inline-flex items-center justify-center rounded-md border border-site-border px-6 py-3 text-sm font-medium text-site-text no-underline transition-colors hover:bg-site-card"
            >
              {t('welcome.heroLiveCta')}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-20 max-w-7xl animate-[fadeInUp_1s_ease-out_0.5s_forwards] px-6 opacity-0 md:mt-24">
        <LandingHeroMedia />
      </div>
    </section>
  )
}
