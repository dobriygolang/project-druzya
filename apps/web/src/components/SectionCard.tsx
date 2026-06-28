import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Section card chrome from druz9 TodayPage. */
export function SectionCard({
  icon,
  title,
  children,
  className,
}: {
  icon?: ReactNode
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5 card-lift',
        className,
      )}
    >
      <header className="flex items-center gap-2">
        {icon ? <span className="text-text-primary">{icon}</span> : null}
        <h2 className="font-display text-base font-bold leading-tight">{title}</h2>
      </header>
      {children}
    </section>
  )
}
