import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'

const HoneDemoApp = lazy(() => import('@hone/demo').then((m) => ({ default: m.HoneDemoApp })))

interface LandingHoneDemoProps {
  compact?: boolean
}

function DemoShell({ compact, siteTheme }: { compact: boolean; siteTheme: 'dark' | 'light' }) {
  return (
    <Suspense
      fallback={
        <div
          className="h-full w-full"
          style={{ background: 'var(--bg, #0a0a0a)' }}
          aria-hidden="true"
        />
      }
    >
      <HoneDemoApp compact={compact} siteTheme={siteTheme} embedded showcase />
    </Suspense>
  )
}

export function LandingHoneDemo({ compact = false }: LandingHoneDemoProps) {
  const { t } = useI18n()
  const { theme } = useSiteTheme()
  const hostRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setActive(true)
      },
      { rootMargin: '120px' },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="h-full w-full" aria-label={t('welcome.demoAriaLabel')}>
      {active ? <DemoShell compact={compact} siteTheme={theme} /> : null}
    </div>
  )
}
