import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { cn } from '@/lib/cn'

type Props = {
  eyebrow?: string
  title?: string
  description?: ReactNode
  children: ReactNode
  className?: string
  lift?: boolean
}

export function SdvgCard({ eyebrow, title, description, children, className, lift = true }: Props) {
  return (
    <section className={cn('sdvg-card p-5 sm:p-6', lift && 'card-lift', className)}>
      {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
      {title ? <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2> : null}
      {description ? (
        <div className={cn('text-sm leading-relaxed text-text-secondary', title ? 'mt-1' : '')}>
          {description}
        </div>
      ) : null}
      <div className={title || description ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.025em]">
          {title}
        </h1>
        {description ? (
          <div className="max-w-2xl text-[15px] leading-relaxed text-text-secondary">{description}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
