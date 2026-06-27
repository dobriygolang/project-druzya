import clsx from 'clsx'
import { forwardRef, type HTMLAttributes } from 'react'

type Elevation = 'e0' | 'e1' | 'e2'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'button'
  type?: 'button' | 'submit' | 'reset'
  elevation?: Elevation
  padding?: 'sm' | 'md' | 'lg'
}

const elevationClass: Record<Elevation, string> = {
  e0: 'bg-transparent border-transparent',
  e1: 'bg-surface-2 border-border',
  e2: 'bg-surface-1 border-border-strong shadow-card',
}

const padClass = { sm: 'p-3', md: 'p-5', lg: 'p-6' }

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { as: Tag = 'div', type, elevation = 'e1', padding = 'md', className, ...props },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      type={Tag === 'button' ? (type ?? 'button') : undefined}
      className={clsx(
        'rounded-xl border text-left',
        Tag === 'button' && 'cursor-pointer appearance-none font-inherit',
        elevationClass[elevation],
        padClass[padding],
        className,
      )}
      {...props}
    />
  )
})
