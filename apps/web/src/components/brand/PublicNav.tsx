import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { readAccessToken } from '@/lib/apiClient'
import { brand } from '@/lib/brand/tokens'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

type LinkItem = { href: string; label: string; external?: boolean }

type Props = {
  centerLinks?: LinkItem[]
  right?: ReactNode
  className?: string
}

const defaultCenter: LinkItem[] = [
  { href: '/welcome#features', label: 'Возможности' },
  { href: '/pricing', label: 'Тарифы' },
  { href: 'https://t.me/druz9', label: 'Канал', external: true },
]

export function PublicNav({ centerLinks = defaultCenter, right, className }: Props) {
  const isAuthed = !!readAccessToken()

  return (
    <header className={cn('border-b bg-bg', className)} style={{ borderColor: brand.hair }}>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-6 py-5 sm:px-8">
        <Logo to="/welcome" />

        <nav className="hidden items-center gap-7 md:flex">
          {centerLinks.map((item) =>
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
          {right ??
            (isAuthed ? (
              <Link
                to="/today"
                className="rounded-lg px-3.5 py-2 text-sm font-medium no-underline"
                style={{ background: brand.ink, color: brand.bg }}
              >
                В приложение
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden text-sm no-underline sm:inline"
                  style={{ color: brand.ink60 }}
                >
                  Войти
                </Link>
                <Link
                  to="/login"
                  className="rounded-lg px-3.5 py-2 text-sm font-medium no-underline"
                  style={{ background: brand.ink, color: brand.bg }}
                >
                  Начать бесплатно
                </Link>
              </>
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
