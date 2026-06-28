import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Logo } from '@/components/brand/Logo'
import { PublicPageShell } from '@/components/brand/PublicNav'
import { brand } from '@/lib/brand/tokens'
import { useI18n } from '@/lib/i18n'

export function LegalLayout({
  eyebrow,
  title,
  updated,
  children,
  footer,
  nav,
}: {
  eyebrow: string
  title: string
  updated: string
  children: ReactNode
  footer?: ReactNode
  nav?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <PublicPageShell>
      <header className="border-b px-6 py-5" style={{ borderColor: brand.hair }}>
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-4">
          <Logo to="/welcome" />
          <div className="flex items-center gap-3">
            <LocaleSwitcher compact />
            {nav}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-6 py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{eyebrow}</p>
        <h1 className="mt-3 text-[36px] font-semibold tracking-tight sm:text-[44px]">{title}</h1>
        <p className="mt-3 text-[12.5px] text-text-secondary">
          {t('legal.layout.updated')} {updated}
        </p>
        <article className="mt-10 space-y-8 text-[14.5px] leading-[1.7] text-text-primary/80">
          {children}
        </article>
        {footer ? (
          <div className="mt-16 border-t pt-6 text-[12.5px] text-text-muted" style={{ borderColor: brand.hair }}>
            {footer}
          </div>
        ) : null}
      </main>
    </PublicPageShell>
  )
}

export function LegalNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[13px] tracking-wide text-text-secondary no-underline hover:underline">
      {children}
    </Link>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[18px] font-medium">{title}</h2>
      {children}
    </section>
  )
}
