import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/brand/SiteHeader'
import { SiteThemeShell, useSiteTheme } from '@/lib/site/useSiteTheme'

type LinkItem = { href: string; label: string; external?: boolean }

type ShellProps = {
  children: ReactNode
  hideHeader?: boolean
  centerLinks?: LinkItem[]
  headerRight?: ReactNode
}

/** Site-wide page shell: theme + shared header. */
export function PublicPageShell({ children, hideHeader, centerLinks, headerRight }: ShellProps) {
  const { theme } = useSiteTheme()

  return (
    <SiteThemeShell
      theme={theme}
      className="min-h-screen bg-site-bg font-sans text-site-text selection:bg-site-accent/20 selection:text-site-text"
    >
      {!hideHeader ? <SiteHeader centerLinks={centerLinks} right={headerRight} /> : null}
      {children}
    </SiteThemeShell>
  )
}

/** @deprecated Use SiteHeader */
export const PublicNav = SiteHeader
