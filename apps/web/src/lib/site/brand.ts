/** Public product name on druz9.online (web). Desktop release tags may still use hone-v*. */
export const SITE_NAME = 'Friends'

export const SITE_DOMAIN = 'druz9.online'

const DEFAULT_ORIGIN = `https://${SITE_DOMAIN}`

export function siteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_ORIGIN?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return DEFAULT_ORIGIN
}

export function formatPageTitle(pageTitle?: string): string {
  const trimmed = pageTitle?.trim()
  if (!trimmed) return `${SITE_NAME} — calm workspace for builders`
  return `${trimmed} · ${SITE_NAME}`
}
