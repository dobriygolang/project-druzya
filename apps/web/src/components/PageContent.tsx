import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Canonical page width/padding — matches druz9 TodayPage layout. */
export function PageContent({
  children,
  className,
  wide,
}: {
  children: ReactNode
  className?: string
  /** Wider layout for editor / live room pages. */
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-6 px-6 py-10 sm:px-8 sm:py-14',
        wide ? 'max-w-[1200px]' : 'max-w-4xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
