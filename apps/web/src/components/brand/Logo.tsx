import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Props = {
  to?: string
  size?: 'sm' | 'md'
  showText?: boolean
  className?: string
}

export function Logo({ to = '/welcome', size = 'md', showText = true, className }: Props) {
  const px = size === 'sm' ? 22 : 26
  const nameSize = size === 'sm' ? 'text-[13px]' : 'text-[15px]'

  const inner = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/favicon.svg"
        width={px}
        height={px}
        alt=""
        className="shrink-0 rounded-[7px]"
        draggable={false}
      />
      {showText ? (
        <span className={cn('font-semibold tracking-[-0.03em] text-site-text', nameSize)}>Hone</span>
      ) : null}
    </span>
  )

  if (!to) return inner
  return (
    <Link to={to} className="no-underline transition-opacity hover:opacity-80" aria-label="Hone home">
      {inner}
    </Link>
  )
}
