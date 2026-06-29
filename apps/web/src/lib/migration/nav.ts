import { useMemo } from 'react'
import { FEATURES, isNavVisible } from './features'
import { useI18n } from '@/lib/i18n'

export type NavItem = { to: string; label: string; primary?: boolean }

function isRouteVisible(path: string): boolean {
  const feature = FEATURES.find((f) => f.path === path)
  return feature ? isNavVisible(feature.status) : false
}

export function usePrimaryNav(): NavItem[] {
  const { t } = useI18n()
  return useMemo(
    () =>
      [
        { to: '/today', label: t('nav.today') },
        { to: '/tasks', label: t('nav.tasks') },
        { to: '/mock', label: t('nav.mock') },
        { to: '/learn', label: t('nav.learn') },
      ].filter((item) => isRouteVisible(item.to)),
    [t],
  )
}

export function useMobileNav(): NavItem[] {
  const { t } = useI18n()
  return useMemo(
    () =>
      [
        { to: '/today', label: t('nav.today') },
        { to: '/mock', label: t('nav.mock'), primary: true },
        { to: '/learn', label: t('nav.learn') },
        { to: '/profile', label: t('nav.profile') },
      ].filter((item) => isRouteVisible(item.to)),
    [t],
  )
}
