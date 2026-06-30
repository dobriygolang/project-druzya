/** Token classes for pages inside PublicPageShell. */
export function siteAwareClasses(_authed?: boolean) {
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
