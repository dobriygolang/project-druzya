import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Props = {
  to?: string
  size?: 'sm' | 'md'
  className?: string
}

function LogoMark({ size }: { size: 'sm' | 'md' }) {
  const px = size === 'sm' ? 18 : 20
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="7.5" cy="10" r="4.25" className="fill-text-primary/85" />
      <circle cx="12.5" cy="10" r="4.25" className="fill-success" />
    </svg>
  )
}

export function Logo({ to = '/welcome', size = 'md', className }: Props) {
  const nameSize = size === 'sm' ? 'text-[13px]' : 'text-[15px]'
  const suffixSize = size === 'sm' ? 'text-[12px]' : 'text-[14px]'

  const inner = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      <span className={cn('inline-flex items-baseline gap-0 tracking-[-0.02em]', nameSize)}>
        <span className="font-semibold text-text-primary">druz9</span>
        <span className={cn('font-normal text-text-muted', suffixSize)}>.online</span>
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
