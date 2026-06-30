import { Fragment } from 'react'
import { LandingDownloadButton } from '@/components/landing/LandingDownloadButton'
import { useLandingDownload } from '@/lib/landing/useLandingDownload'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'

export function LandingPhilosophy() {
  const { t } = useI18n()
  const { theme } = useSiteTheme()
  const { releasePageUrl, version } = useLandingDownload()
  const isDark = theme === 'dark'
  const lines = t('welcome.philosophyBody').split('\n')

  return (
    <section id="manifesto" className="scroll-mt-24 border-t border-site-border bg-site-surface py-32">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-8 font-mono text-sm uppercase tracking-widest text-site-muted">
          {t('welcome.philosophyTitle')}
        </h2>

        <div className="mb-12 overflow-hidden rounded-xl border border-site-border">
          <img
            src={isDark ? '/landing/landing-philosophy-dark.png' : '/landing/landing-philosophy-light.png'}
            alt=""
            aria-hidden="true"
            className="h-full max-h-[420px] w-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="mx-auto max-w-none text-lg leading-relaxed text-site-muted">
          <p className="m-0 text-site-text/85">
            {lines.map((line, index) => (
              <Fragment key={`${index}-${line.slice(0, 8)}`}>
                {line}
                {index < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        </div>

        <div
          id="download"
          className="mt-14 flex scroll-mt-24 flex-col items-start gap-4 rounded-xl border border-site-border bg-site-card/50 p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="m-0 text-base font-medium text-site-text">{t('welcome.manifestoDownloadTitle')}</p>
            <p className="mt-1 mb-0 text-sm text-site-muted">
              {version
                ? t('welcome.manifestoDownloadHintVersion', { version })
                : t('welcome.manifestoDownloadHint')}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <LandingDownloadButton />
            <a
              href={releasePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs text-site-muted underline underline-offset-4 transition-colors hover:text-site-text"
            >
              {t('welcome.allReleases')}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
