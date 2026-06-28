import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/cn'

const button = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-sans font-medium whitespace-nowrap select-none',
    'transition-colors duration-[var(--motion-dur-small)] ease-[var(--motion-ease-standard)]',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:opacity-50 disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary: 'rounded-lg bg-text-primary text-bg hover:bg-text-primary/90',
        secondary:
          'rounded-lg border border-border-strong bg-surface-1 text-text-primary hover:bg-surface-2',
        ghost:
          'rounded-lg border border-border bg-transparent text-text-primary hover:bg-surface-2',
        danger: 'rounded-lg bg-danger text-white hover:brightness-110',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-[14px]',
        lg: 'h-12 px-6 text-[15px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonVariantProps = VariantProps<typeof button>

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>,
    ButtonVariantProps {
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

const Spinner: React.FC = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path
      d="M22 12a10 10 0 0 0-10-10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
)

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading = false, disabled, icon, iconRight, children, type, ...props },
    ref,
  ) => {
    const reduced = useReducedMotion()
    const isDisabled = disabled || loading
    const motionProps =
      reduced || isDisabled ? {} : { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } }
    return (
      <motion.button
        ref={ref}
        type={type ?? 'button'}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(button({ variant, size }), className)}
        {...motionProps}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
      >
        {loading ? <Spinner /> : icon}
        {children}
        {!loading && iconRight}
      </motion.button>
    )
  },
)
Button.displayName = 'Button'
