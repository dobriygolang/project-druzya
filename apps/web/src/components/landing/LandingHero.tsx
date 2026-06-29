import { LandingDownloadButton } from '@/components/landing/LandingDownloadButton'
import { useI18n } from '@/lib/i18n'

export function LandingHero() {
  const { t } = useI18n()

  return (
    <section className="relative overflow-hidden pb-20 pt-32 md:pb-32 md:pt-48">
      <div className="pointer-events-none absolute right-0 top-0 z-0 h-full w-full opacity-20">
        <div className="absolute right-[-10%] top-[10%] h-[800px] w-[800px] rounded-full bg-white opacity-5 blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <div className="landing-fade-in mb-8 inline-flex animate-[fadeInUp_0.8s_ease-out_forwards] items-center gap-2 rounded-full border border-winter-border bg-winter-card px-3 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="font-mono text-xs text-winter-muted">{t('welcome.pill')}</span>
          </div>

          <h1 className="landing-fade-in mb-8 animate-[fadeInUp_0.8s_ease-out_0.1s_forwards] text-5xl font-bold leading-[1.1] tracking-tight text-white opacity-0 md:text-7xl">
            {t('welcome.heroLine1')}{' '}
            <br />
            <span className="bg-gradient-to-r from-white to-gray-600 bg-clip-text text-transparent">
              {t('welcome.heroLine2')}
              <br />
              {t('welcome.heroLine3')}
            </span>
          </h1>

          <p className="landing-fade-in mb-10 max-w-xl animate-[fadeInUp_0.8s_ease-out_0.2s_forwards] text-lg leading-relaxed text-winter-muted opacity-0 md:text-xl">
            {t('welcome.heroBody')}
          </p>

          <div className="landing-fade-in flex animate-[fadeInUp_0.8s_ease-out_0.3s_forwards] flex-col gap-4 opacity-0 sm:flex-row">
            <LandingDownloadButton />
          </div>
        </div>
      </div>

      <div className="landing-fade-in relative z-10 mx-auto mt-24 max-w-7xl animate-[fadeInUp_1s_ease-out_0.5s_forwards] px-6 opacity-0">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-winter-border bg-black shadow-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 40%, #0a0a0a 100%)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-winter-border bg-winter-card/80 px-8 py-6 text-center backdrop-blur-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white">
                <svg width="28" height="28" viewBox="0 0 128 128" fill="none" aria-hidden>
                  <line x1="38" y1="78" x2="90" y2="50" stroke="#0a0a0a" strokeWidth="10" strokeLinecap="round" />
                  <circle cx="92" cy="48" r="8" fill="#FF3B30" />
                </svg>
              </div>
              <p className="m-0 font-mono text-xs uppercase tracking-widest text-winter-muted">Hone workspace</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
