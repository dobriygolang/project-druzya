import type { ReactNode } from 'react'
import { PublicPageShell } from '@/components/brand/PublicNav'

type LinkItem = { href: string; label: string; external?: boolean }

type Props = {
  children: ReactNode
  headerRight?: ReactNode
  centerLinks?: LinkItem[]
  hideHeader?: boolean
}

export function PublicOrAuthedShell({ children, headerRight, centerLinks, hideHeader }: Props) {
  return (
    <PublicPageShell centerLinks={centerLinks} headerRight={headerRight} hideHeader={hideHeader}>
      {children}
    </PublicPageShell>
  )
}
