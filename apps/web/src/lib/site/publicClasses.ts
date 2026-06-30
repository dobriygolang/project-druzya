import { hasValidAccessToken } from '@/lib/apiClient'

/** Token classes for pages that render in PublicPageShell (guest) or AppShell (authed). */
export function siteAwareClasses(authed = hasValidAccessToken()) {
  if (authed) {
    return {
      text: 'text-text-primary',
      muted: 'text-text-muted',
      secondary: 'text-text-secondary',
      card: 'rounded-2xl border border-border bg-surface-1',
      cardMuted: 'rounded-2xl border border-border bg-surface-2',
      border: 'border-border',
      link: 'text-text-primary underline underline-offset-2 hover:text-text-secondary',
    }
  }
  return {
    text: 'text-site-text',
    muted: 'text-site-muted',
    secondary: 'text-site-muted',
    card: 'rounded-2xl border border-site-border bg-site-card',
    cardMuted: 'rounded-2xl border border-site-border bg-site-surface',
    border: 'border-site-border',
    link: 'text-site-text underline underline-offset-2 hover:text-site-muted',
  }
}
