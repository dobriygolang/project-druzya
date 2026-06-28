import { useState } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  name: string
  avatarUrl?: string
  className?: string
  textClassName?: string
}

export function UserAvatar({ name, avatarUrl, className, textClassName }: Props) {
  const [failed, setFailed] = useState(false)
  const initial = name.trim().slice(0, 1).toUpperCase() || '?'

  if (!avatarUrl || failed) {
    return (
      <span className={cn('grid place-items-center font-semibold text-text-secondary', className, textClassName)}>
        {initial}
      </span>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      className={cn('h-full w-full object-cover', className)}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
