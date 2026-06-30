import { useSiteTheme } from '@/lib/site/useSiteTheme'
import { heroPosterUrl, heroVideoUrl } from '@/lib/landing/media'
import { useI18n } from '@/lib/i18n'

export function LandingHeroMedia() {
  const { t } = useI18n()
  const { theme } = useSiteTheme()
  const videoSrc = heroVideoUrl()
  const poster = heroPosterUrl()
  const isDark = theme === 'dark'

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-site-border bg-site-card shadow-2xl">
      {videoSrc ? (
        <video
          src={videoSrc}
          poster={poster ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 40%, #0a0a0a 100%)'
                : 'linear-gradient(135deg, #f7f7f5 0%, #ffffff 45%, #f0f0ed 100%)',
            }}
          />
          <img
            src={isDark ? '/landing/landing-hero-dark.png' : '/landing/landing-hero-light.png'}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 p-8">
            <div className="w-full max-w-2xl rounded-2xl border border-site-border bg-site-bg/90 p-6 backdrop-blur-sm md:p-8">
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                <span className="h-2.5 w-2.5 rounded-full bg-warn/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
              </div>
              <div className="space-y-3 font-mono text-xs text-site-muted">
                <p className="m-0 text-site-text">{t('welcome.heroPreviewLine1')}</p>
                <p className="m-0">{t('welcome.heroPreviewLine2')}</p>
                <p className="m-0">{t('welcome.heroPreviewLine3')}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
