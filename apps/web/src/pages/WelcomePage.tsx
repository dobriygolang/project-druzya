import { LandingDownloadProvider } from '@/lib/landing/useLandingDownload'
import { LandingDownloadToast } from '@/components/landing/LandingDownloadButton'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingNav } from '@/components/landing/LandingNav'
import { LandingPhilosophy } from '@/components/landing/LandingPhilosophy'
import { SiteThemeShell, useSiteTheme } from '@/lib/site/useSiteTheme'

export default function WelcomePage() {
  const { theme } = useSiteTheme()

  return (
    <SiteThemeShell
      theme={theme}
      className="min-h-screen bg-site-bg font-sans text-site-text selection:bg-site-accent/20 selection:text-site-text"
    >
      <LandingDownloadProvider>
        <LandingNav />
        <main>
          <LandingHero />
          <LandingPhilosophy />
        </main>
        <LandingFooter />
        <LandingDownloadToast />
      </LandingDownloadProvider>
    </SiteThemeShell>
  )
}
