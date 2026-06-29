import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { PAGE_MAX_WIDTH_CLASS } from '@/lib/brand/layout'
import { readAccessToken } from '@/lib/apiClient'
import { brand } from '@/lib/brand/tokens'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

type LinkItem = { href: string; label: string; external?: boolean }

type Props = {
  centerLinks?: LinkItem[]
  right?: ReactNode
  className?: string
}

export function PublicNav({ centerLinks, right, className }: Props) {
  const { t } = useI18n()
  const isAuthed = !!readAccessToken()

  const defaultCenter: LinkItem[] = [
    { href: '/welcome#features', label: t('public.features') },
    { href: '/live/new', label: t('public.liveCoding') },
    { href: '/pricing', label: t('public.pricing') },
    { href: 'https://t.me/gogymtrip', label: t('public.channel'), external: true },
  ]

  const links = centerLinks ?? defaultCenter

  return (
    <header className={cn('border-b bg-bg', className)} style={{ borderColor: brand.hair }}>
      <div className={cn('mx-auto flex items-center justify-between gap-3 px-6 py-5 sm:px-8', PAGE_MAX_WIDTH_CLASS)}>
        <Logo to="/welcome" />

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm no-underline transition-colors hover:text-text-primary"
                style={{ color: brand.ink60 }}
              >
                {item.label}
              </a>
            ) : item.href.startsWith('/') ? (
              <Link
                key={item.href}
                to={item.href}
                className="text-sm no-underline transition-colors hover:text-text-primary"
                style={{ color: brand.ink60 }}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="text-sm no-underline transition-colors hover:text-text-primary"
                style={{ color: brand.ink60 }}
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <LocaleSwitcher compact className="hidden sm:flex" />
          {right ??
            (isAuthed ? (
              <Link
                to="/today"
                className="rounded-lg px-3.5 py-2 text-sm font-medium no-underline"
                style={{ background: brand.ink, color: brand.bg }}
              >
                {t('public.openApp')}
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium no-underline"
                style={{ background: brand.ink, color: brand.bg }}
              >
                {t('public.startFree')}
              </Link>
            ))}
        </div>
      </div>
    </header>
  )
}

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text-primary" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {children}
    </div>
  )
}
