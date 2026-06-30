import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Props = {
  to?: string
  size?: 'sm' | 'md'
  tone?: 'light' | 'dark'
  className?: string
}

function HoneMark({ size, tone }: { size: 'sm' | 'md'; tone: 'light' | 'dark' }) {
  const px = size === 'sm' ? 22 : 26
  const tile = tone === 'dark' ? '#ffffff' : '#0a0a0a'
  const line = tone === 'dark' ? '#0a0a0a' : '#ffffff'
  const dot = '#FF3B30'

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0 rounded-[7px]"
    >
      <rect width="128" height="128" rx="28" fill={tile} />
      <line x1="20" y1="92" x2="108" y2="92" stroke={tone === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)'} strokeWidth="4" />
      <line x1="38" y1="78" x2="90" y2="50" stroke={line} strokeWidth="10" strokeLinecap="round" />
      <circle cx="92" cy="48" r="8" fill={dot} />
    </svg>
  )
}

export function Logo({ to = '/welcome', size = 'md', tone = 'light', className }: Props) {
  const nameSize = size === 'sm' ? 'text-[13px]' : 'text-[15px]'

  const inner = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <HoneMark size={size} tone={tone} />
      <span className={cn('font-semibold tracking-[-0.03em]', nameSize, tone === 'dark' ? 'text-white' : 'text-site-text')}>
        Hone
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
