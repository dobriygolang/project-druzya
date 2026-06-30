export type SiteTheme = 'dark' | 'light'

const STORAGE_KEY = 'hone-site-theme'

export function readSiteTheme(): SiteTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* noop */
  }
  return 'dark'
}

export function writeSiteTheme(theme: SiteTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* noop */
  }
}
