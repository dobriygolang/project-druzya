import { cn } from '@/lib/cn'
import { useI18n, type Locale } from '@/lib/i18n'

type Props = {
  compact?: boolean
  className?: string
}

/** Shows the target locale code — click toggles en ↔ ru. */
export function SiteLocaleToggle({ compact, className }: Props) {
  const { locale, setLocale, t } = useI18n()
  const next: Locale = locale === 'en' ? 'ru' : 'en'
  const label = next

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={t('locale.label')}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-site-border bg-site-card font-mono text-xs uppercase tracking-wide text-site-muted transition-colors hover:text-site-text',
        compact ? 'h-9 min-w-9 px-2' : 'h-9 px-3 text-sm',
        className,
      )}
    >
      {label}
    </button>
  )
}
