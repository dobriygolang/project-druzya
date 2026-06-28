import type { ReactNode } from 'react'
import { PAGE_MAX_WIDTH_CLASS } from '@/lib/brand/layout'
import { cn } from '@/lib/cn'

/** Canonical page width/padding — same on every authed page. */
export function PageContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-6 px-6 py-10 sm:px-8 sm:py-14',
        PAGE_MAX_WIDTH_CLASS,
        className,
      )}
    >
      {children}
    </div>
  )
}
