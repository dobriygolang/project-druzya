import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { detectPlatform, downloadUrlFor } from '@/lib/landing/downloads'
import { useI18n } from '@/lib/i18n'

type Props = {
  sentinelRef?: React.Ref<HTMLDivElement>
}

export function LandingHero({ sentinelRef }: Props) {
  const { t } = useI18n()
  const platform = useMemo(() => detectPlatform(), [])
  const downloadUrl = downloadUrlFor(platform)
  const [downloaded, setDownloaded] = useState(false)

  function onDownload() {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
      setDownloaded(true)
      return
    }
    setDownloaded(true)
  }

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#0a0a0a] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,255,255,0.12), transparent 60%), radial-gradient(circle at 85% 20%, rgba(255,59,48,0.08), transparent 40%)',
        }}
      />

      <div className="relative mx-auto flex min-h-[100svh] max-w-[920px] flex-col items-center justify-center px-6 pb-32 pt-28 text-center sm:px-8">
        <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">
          {t('welcome.pill')}
        </p>

        <h1 className="max-w-[18ch] text-[clamp(2.5rem,7vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.04em]">
          {t('welcome.heroLine1')}
          <br />
          <span className="text-white/55">{t('welcome.heroLine2')}</span>
          <br />
          {t('welcome.heroLine3')}
        </h1>

        <p className="mt-7 max-w-[42ch] text-[17px] leading-relaxed text-white/55">
          {t('welcome.heroBody')}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          {downloadUrl ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-white px-8 py-3.5 text-[15px] font-medium text-[#0a0a0a] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {downloaded ? t('welcome.downloadStarted') : t('welcome.downloadCta')}
            </button>
          ) : (
            <Link
              to="/login?next=/welcome"
              className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-white px-8 py-3.5 text-[15px] font-medium text-[#0a0a0a] no-underline transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('welcome.earlyAccessCta')}
            </Link>
          )}
          <p className="text-[13px] text-white/40">{t('welcome.heroPlatforms')}</p>
        </div>

        <div ref={sentinelRef} className="absolute bottom-[28%] h-px w-px opacity-0" aria-hidden />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(28vh,220px)]"
        aria-hidden
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(250,250,248,0.04) 35%, rgba(250,250,248,0.55) 72%, #fafaf8 100%)',
        }}
      />
    </section>
  )
}
