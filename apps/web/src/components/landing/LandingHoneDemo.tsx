import { HoneDemoApp } from '@hone/demo'
import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'

interface LandingHoneDemoProps {
  compact?: boolean
}

export function LandingHoneDemo({ compact = false }: LandingHoneDemoProps) {
  const { t } = useI18n()
  const { theme } = useSiteTheme()

  return (
    <div className="h-full w-full" aria-label={t('welcome.demoAriaLabel')}>
      <HoneDemoApp compact={compact} siteTheme={theme} />
    </div>
  )
}
