import { Link } from 'react-router-dom'
import { brand } from '@/lib/brand/tokens'
import { useI18n } from '@/lib/i18n'

export function LandingFeatures() {
  const { t } = useI18n()

  const features = [
    { title: t('welcome.featScheduleTitle'), text: t('welcome.featScheduleText') },
    { title: t('welcome.featNotesTitle'), text: t('welcome.featNotesText') },
    { title: t('welcome.featFocusTitle'), text: t('welcome.featFocusText') },
    { title: t('welcome.featLiveTitle'), text: t('welcome.featLiveText'), cta: t('welcome.featLiveCta'), to: '/live/new' },
  ]

  return (
    <section id="features" className="border-t border-border bg-bg px-6 py-24 sm:px-8">
      <div className="mx-auto max-w-[920px]">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-text-muted">
          {t('welcome.featuresEyebrow')}
        </p>
        <h2 className="mt-4 text-center text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-[-0.03em]">
          {t('welcome.featuresTitle')}
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-center text-[15px] leading-relaxed text-text-secondary">
          {t('welcome.featuresBody')}
        </p>

        <div className="mt-14 grid gap-10 sm:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: brand.dot }} />
                <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{feature.title}</h3>
              </div>
              <p className="m-0 max-w-[36ch] text-[14.5px] leading-relaxed text-text-secondary">{feature.text}</p>
              {'cta' in feature && feature.to ? (
                <Link
                  to={feature.to}
                  className="mt-3 inline-block text-[13.5px] font-medium text-text-primary no-underline hover:underline"
                >
                  {feature.cta}
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
