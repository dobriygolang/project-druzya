import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const suffix = count != null && count > 0 ? ` (${count})` : ''

  return (
    <section className="rounded-xl border border-border bg-surface-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {title}
          {suffix}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open ? <div className="border-t border-border px-4 py-3">{children}</div> : null}
    </section>
  )
}
