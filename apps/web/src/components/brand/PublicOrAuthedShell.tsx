import type { ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'
import { PublicNav, PublicPageShell } from '@/components/brand/PublicNav'
import { readAccessToken } from '@/lib/apiClient'

type LinkItem = { href: string; label: string; external?: boolean }

type Props = {
  children: ReactNode
  /** Shown only when the visitor is not signed in. */
  publicNav?: {
    centerLinks?: LinkItem[]
    right?: ReactNode
  }
}

export function PublicOrAuthedShell({ children, publicNav }: Props) {
  const isAuthed = !!readAccessToken()

  if (isAuthed) {
    return <AppShell>{children}</AppShell>
  }

  return (
    <PublicPageShell>
      <PublicNav centerLinks={publicNav?.centerLinks} right={publicNav?.right} />
      {children}
    </PublicPageShell>
  )
}
