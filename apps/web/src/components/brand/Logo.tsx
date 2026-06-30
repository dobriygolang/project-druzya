import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/site/brand'

type Props = {
  to?: string
  size?: 'sm' | 'md'
  className?: string
}

/** FRIENDS wordmark — matches Hone desktop Chrome header. */
export function Logo({ to = '/welcome', size = 'md', className }: Props) {
  const inner = (
    <span
      className={cn(
        'inline-block border-b border-site-text/60 font-mono font-bold uppercase text-site-text',
        size === 'sm' ? 'pb-1 text-xs tracking-[0.28em]' : 'pb-1.5 text-sm tracking-[0.32em]',
        className,
      )}
    >
      {SITE_NAME.toUpperCase()}
    </span>
  )

  if (!to) return inner
  return (
    <Link to={to} className="no-underline transition-opacity hover:opacity-80" aria-label={`${SITE_NAME} home`}>
      {inner}
    </Link>
  )
}
