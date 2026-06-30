import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import type { SiteTheme } from '@/lib/site/theme'

type Props = {
  theme: SiteTheme
  onToggle: () => void
  compact?: boolean
  className?: string
}

export function SiteThemeToggle({ theme, onToggle, compact, className }: Props) {
  const { t } = useI18n()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? t('public.themeLight') : t('public.themeDark')}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-site-border bg-site-card text-site-muted transition-colors hover:text-site-text',
        compact ? 'h-9 w-9' : 'h-9 px-3 gap-2 text-sm',
        className,
      )}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {!compact ? <span>{isDark ? t('public.themeLight') : t('public.themeDark')}</span> : null}
    </button>
  )
}
