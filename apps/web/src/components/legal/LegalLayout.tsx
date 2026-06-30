import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicPageShell } from '@/components/brand/PublicNav'
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
      <main className="mx-auto max-w-[760px] px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-site-muted">{eyebrow}</p>
          {nav}
        </div>
        <h1 className="mt-3 text-[36px] font-semibold tracking-tight text-site-text sm:text-[44px]">{title}</h1>
        <p className="mt-3 text-[12.5px] text-site-muted">
          {t('legal.layout.updated')} {updated}
        </p>
        <article className="mt-10 space-y-8 text-[14.5px] leading-[1.7] text-site-text/85">{children}</article>
        {footer ? (
          <div className="mt-16 border-t border-site-border pt-6 text-[12.5px] text-site-muted">{footer}</div>
        ) : null}
      </main>
    </PublicPageShell>
  )
}

export function LegalNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[13px] tracking-wide text-site-muted no-underline hover:text-site-text hover:underline">
      {children}
    </Link>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[18px] font-medium text-site-text">{title}</h2>
      {children}
    </section>
  )
}
