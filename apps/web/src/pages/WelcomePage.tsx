import { LandingDownloadToast } from '@/components/landing/LandingDownloadButton'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingPhilosophy } from '@/components/landing/LandingPhilosophy'
import { PublicPageShell } from '@/components/brand/PublicNav'

export default function WelcomePage() {
  return (
    <PublicPageShell>
      <main>
        <LandingHero />
        <LandingPhilosophy />
      </main>
      <LandingFooter />
      <LandingDownloadToast />
    </PublicPageShell>
  )
}
