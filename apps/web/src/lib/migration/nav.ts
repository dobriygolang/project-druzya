import { FEATURES, isNavVisible } from './features'

export type NavItem = { to: string; label: string; primary?: boolean }

function isRouteVisible(path: string): boolean {
  const feature = FEATURES.find((f) => f.path === path)
  return feature ? isNavVisible(feature.status) : false
}

/** Desktop header + mobile drawer */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/today', label: 'Today' },
  { to: '/mock', label: 'Mock' },
  { to: '/profile', label: 'Profile' },
].filter((item) => isRouteVisible(item.to))

/** Mobile bottom bar */
export const MOBILE_NAV: NavItem[] = [
  { to: '/today', label: 'Today' },
  { to: '/mock', label: 'Mock', primary: true },
  { to: '/profile', label: 'Profile' },
].filter((item) => isRouteVisible(item.to))
