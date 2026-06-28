import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const BG = '#FAFAF8'
const INK = '#0F0F0F'
const INK_60 = '#5B5B5B'
const INK_40 = '#8E8E8E'
const HAIR = 'rgba(15,15,15,0.08)'

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
  return (
    <div
      className="min-h-screen"
      style={{ background: BG, color: INK, fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      <header style={{ borderBottom: `1px solid ${HAIR}`, padding: '20px 24px' }}>
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-4">
          <Link to="/welcome" className="text-[15px] font-semibold tracking-wide no-underline" style={{ color: INK }}>
            druz9.online
          </Link>
          {nav}
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-6 py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: INK_40 }}>
          {eyebrow}
        </p>
        <h1 className="mt-3 text-[36px] font-semibold tracking-tight sm:text-[44px]">{title}</h1>
        <p className="mt-3 text-[12.5px]" style={{ color: INK_60 }}>
          Последнее обновление: {updated}
        </p>
        <article
          className="mt-10 space-y-8 text-[14.5px] leading-[1.7]"
          style={{ color: 'rgba(15,15,15,0.8)' }}
        >
          {children}
        </article>
        {footer ? (
          <div className="mt-16 border-t pt-6 text-[12.5px]" style={{ borderColor: HAIR, color: INK_40 }}>
            {footer}
          </div>
        ) : null}
      </main>
    </div>
  )
}

export function LegalNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[13px] no-underline tracking-wide hover:underline" style={{ color: INK_60 }}>
      {children}
    </Link>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[18px] font-medium" style={{ color: INK }}>
        {title}
      </h2>
      {children}
    </section>
  )
}
