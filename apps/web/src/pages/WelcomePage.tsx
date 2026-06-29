import { useEffect, useRef } from 'react'
import { LandingFeatures } from '@/components/landing/LandingFeatures'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingNav } from '@/components/landing/LandingNav'
import { LandingPhilosophy } from '@/components/landing/LandingPhilosophy'
import { LandingPricing } from '@/components/landing/LandingPricing'

export default function WelcomePage() {
  const heroSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.scrollBehavior
    html.style.scrollBehavior = 'smooth'
    html.classList.remove('dark')
    html.classList.add('light')
    return () => {
      html.style.scrollBehavior = prev
    }
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <LandingNav heroSentinelRef={heroSentinelRef} />
      <main>
        <LandingHero sentinelRef={heroSentinelRef} />
        <LandingPhilosophy />
        <LandingFeatures />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  )
}
