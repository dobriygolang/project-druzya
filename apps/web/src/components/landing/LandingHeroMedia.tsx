import { heroPosterUrl, heroVideoUrl } from '@/lib/landing/media'
import { LandingHoneDemo } from '@/components/landing/LandingHoneDemo'

export function LandingHeroMedia() {
  const videoSrc = heroVideoUrl()
  const poster = heroPosterUrl()

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
        <LandingHoneDemo mode="interactive" showThemePicker />
      )}
    </div>
  )
}
