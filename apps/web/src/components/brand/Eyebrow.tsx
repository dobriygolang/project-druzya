import { cn } from '@/lib/cn'

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted',
        className,
      )}
    >
      {children}
    </p>
  )
}
