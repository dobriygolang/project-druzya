import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PAGE_MAX_WIDTH_CLASS } from '@/lib/brand/layout'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

type QuickLink = { to: string; label: string; description: string }

export function TodayPageShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const quickLinks: QuickLink[] = [
    { to: '/mock', label: t('nav.mock'), description: t('today.shell.mockHint') },
    { to: '/learn', label: t('nav.learn'), description: t('today.shell.learnHint') },
    { to: '/pricing', label: t('common.pricing'), description: t('today.shell.pricingHint') },
  ]

  return (
    <div className={cn('mx-auto w-full px-6 py-8 sm:px-8', PAGE_MAX_WIDTH_CLASS)}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-10">
        <div className="min-w-0 flex flex-col gap-8">{children}</div>
        <aside className="hidden lg:block">
          <nav
            aria-label={t('today.shell.quickNav')}
            className="sticky top-24 rounded-2xl border border-border bg-surface-1 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {t('today.shell.quickNav')}
            </p>
            <ul className="mt-3 space-y-3">
              {quickLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="group block rounded-lg px-2 py-1.5 no-underline transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-text-primary">
                      {item.label}
                      <ArrowRight className="h-3.5 w-3.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  )
}
