import { useEffect } from 'react'
import { LandingDownloadProvider } from '@/lib/landing/useLandingDownload'
import { LandingDownloadToast } from '@/components/landing/LandingDownloadButton'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingNav } from '@/components/landing/LandingNav'
import { LandingPhilosophy } from '@/components/landing/LandingPhilosophy'

export default function WelcomePage() {
  useEffect(() => {
    const html = document.documentElement
    const prevScroll = html.style.scrollBehavior
    html.style.scrollBehavior = 'smooth'
    html.classList.remove('light')
    html.classList.add('dark')
    document.body.classList.add('landing-page')
    return () => {
      html.style.scrollBehavior = prevScroll
      html.classList.remove('dark')
      html.classList.add('light')
      document.body.classList.remove('landing-page')
    }
  }, [])

  return (
    <LandingDownloadProvider>
      <div className="min-h-screen bg-winter-bg font-sans text-winter-text selection:bg-white/20 selection:text-white">
        <LandingNav />
        <main>
          <LandingHero />
          <LandingPhilosophy />
        </main>
        <LandingFooter />
        <LandingDownloadToast />
      </div>
    </LandingDownloadProvider>
  )
}
