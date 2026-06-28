import { useQueryClient } from '@tanstack/react-query'
import { useI18n, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const OPTIONS: Locale[] = ['ru', 'en']

type Props = {
  className?: string
  compact?: boolean
}

export function LocaleSwitcher({ className, compact }: Props) {
  const { locale, setLocale, t } = useI18n()
  const qc = useQueryClient()

  function select(next: Locale) {
    if (next === locale) return
    setLocale(next)
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label={t('locale.label')}>
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => select(opt)}
          className={cn(
            'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
            locale === opt
              ? 'border-border-strong bg-surface-2 text-text-primary'
              : 'border-transparent text-text-muted hover:border-border hover:bg-surface-1 hover:text-text-primary',
            compact && 'px-1.5 py-0.5',
          )}
          aria-pressed={locale === opt}
        >
          {opt.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
