import { Link } from 'react-router-dom'
import { brand } from '@/lib/brand/tokens'
import { cn } from '@/lib/cn'

type Props = {
  to?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Logo({ to = '/welcome', size = 'md', className }: Props) {
  const textSize = size === 'sm' ? 'text-sm' : 'text-[15px]'
  const dotSize = size === 'sm' ? 'h-[6px] w-[6px]' : 'h-[7px] w-[7px]'

  const inner = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn('shrink-0 rounded-full', dotSize)}
        style={{ background: brand.dot }}
        aria-hidden
      />
      <span className={cn('font-medium tracking-[-0.005em]', textSize)} style={{ color: brand.ink }}>
        druz9.online
      </span>
    </span>
  )

  if (!to) return inner
  return (
    <Link to={to} className="no-underline">
      {inner}
    </Link>
  )
}
