import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
  className?: string
  size?: 'sm' | 'md'
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  'aria-label': ariaLabel,
  className,
  size = 'md',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((opt) => opt.value === value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-1 text-left text-text-primary outline-none transition-colors',
          'hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-1 focus-visible:ring-text-primary/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-8 px-2.5 text-[12px]' : 'h-10 px-3 text-sm',
        )}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-text-muted')}>
          {selected?.label ?? placeholder ?? '—'}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-surface-1 py-1 shadow-lg"
          style={{ boxShadow: '0 8px 30px -12px rgba(15,15,15,0.25)' }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2',
                    isSelected && 'bg-surface-2 font-medium text-text-primary',
                    !isSelected && 'text-text-secondary',
                    size === 'sm' && 'py-1.5 text-[12px]',
                  )}
                >
                  <Check
                    className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{opt.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
