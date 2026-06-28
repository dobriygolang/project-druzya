import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicNav, PublicPageShell } from '@/components/brand/PublicNav'
import { brand } from '@/lib/brand/tokens'
import { PLAN_CATALOG } from '@/lib/billing/planCatalog'

function DashboardMock() {
  return (
    <div
      className="relative rounded-[18px] border bg-surface-1 p-6"
      style={{ borderColor: brand.hair, boxShadow: brand.cardShadow }}
    >
      <div className="absolute right-[22px] top-[18px] flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[9px] w-[9px] rounded-full bg-black/10" />
        ))}
      </div>
      <div className="mb-[18px] flex items-baseline justify-between">
        <span className="text-[13px] text-text-secondary">Readiness</span>
        <span className="text-[28px] font-semibold tracking-[-0.02em]">68%</span>
      </div>
      <div className="relative mb-[22px] h-1 rounded-sm bg-[rgba(76,179,92,0.2)]">
        <span className="absolute inset-y-0 left-0 w-[68%] rounded-sm" style={{ background: brand.green }} />
      </div>
      <div className="mb-2.5 text-[13px] text-text-secondary">
        Рекомендации <span className="text-text-muted"> 2</span>
      </div>
      <RecCard title="Повторить dynamic programming" sub="Слабое место после mock-сессии" accent />
      <div className="h-2.5" />
      <RecCard title="System design: rate limiter" sub="Следующий шаг в плане" muted />
    </div>
  )
}

function RecCard({
  title,
  sub,
  accent,
  muted,
}: {
  title: string
  sub: string
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div className="relative pl-3.5">
      <span
        className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-sm"
        style={{
          background: accent ? brand.green : muted ? brand.warn : 'rgba(15,15,15,0.18)',
        }}
      />
      <div className="text-[14.5px] font-medium">{title}</div>
      <div className="mt-1 text-[12.5px] text-text-muted">{sub}</div>
    </div>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: brand.dot }} />
      {children}
    </span>
  )
}

export default function WelcomePage() {
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.scrollBehavior
    html.style.scrollBehavior = 'smooth'
    html.classList.add('light')
    return () => {
      html.style.scrollBehavior = prev
    }
  }, [])

  return (
    <PublicPageShell>
      <PublicNav />
      <section className="mx-auto max-w-[1200px] px-8 pb-24 pt-[88px]">
        <div className="hero-grid grid items-center gap-16 lg:grid-cols-2">
          <div>
            <span className="sdvg-pill mb-7">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.dot }} />
              Подготовка к техническим собесам
            </span>
            <h1 className="text-[clamp(40px,6vw,64px)] font-semibold leading-[1.02] tracking-[-0.035em]">
              Mock-интервью с AI-разбором — без шума и геймификации.
            </h1>
            <p className="mt-6 max-w-[460px] text-[17px] leading-relaxed text-text-secondary">
              Компании и шаблоны интервью, алгоритмы, system design и behavioral. После каждой
              попытки — оценка и персональный план, что повторить.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link
                to="/login"
                className="inline-flex items-center rounded-[10px] px-[22px] py-3 text-[15px] font-medium no-underline"
                style={{ background: brand.ink, color: brand.bg }}
              >
                Начать бесплатно
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-1.5 py-3 text-[15px] font-medium no-underline"
              >
                Как это работает →
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-5">
              <Bullet>2 mock-интервью в месяц бесплатно</Bullet>
              <Bullet>AI-оценка ответов</Bullet>
              <Bullet>Live coding с напарником</Bullet>
            </div>
          </div>
          <DashboardMock />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1200px] border-t px-8 pb-28 pt-16" style={{ borderColor: brand.hair }}>
        <div className="surfaces-grid grid items-start gap-16 lg:grid-cols-[1fr_2.4fr]">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-text-muted">Что внутри</p>
            <h2 className="mt-[18px] text-[clamp(28px,3.4vw,38px)] font-semibold leading-[1.1] tracking-[-0.025em]">
              Четыре блока. Один аккаунт.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-text-secondary">
              Всё для подготовки к собесу в одном месте: от mock-сессии до совместного live coding.
            </p>
          </div>
          <div className="surfaces-cells grid gap-x-14 gap-y-12 sm:grid-cols-2">
            <Feature title="Mock-интервью" text="Шаблоны под компании: алгоритмы, SQL, system design и behavioral в одной сессии." />
            <Feature title="AI-разбор" text="После каждой попытки — оценка, фидбек и задачи на повтор. Без «молодец, попробуй ещё»." />
            <Feature muted title="Дашборд" text="Readiness, сильные и слабые навыки, рекомендации и учебный план на основе попыток." />
            <Feature muted title="Live coding" text="Комнаты для совместного решения задач в реальном времени — для парной практики." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-8 pb-28">
        <div className="tracks-grid grid gap-8 rounded-[18px] border bg-surface-1 p-8 sm:grid-cols-3" style={{ borderColor: brand.hair }}>
          {[
            { name: 'Алгоритмы', sub: 'LeetCode-style задачи с запуском кода, тестами и AI-оценкой решения.' },
            { name: 'System design', sub: 'Архитектурные кейсы: масштабирование, trade-offs, диаграммы и устный разбор.' },
            { name: 'Behavioral', sub: 'STAR-ответы, soft skills и типовые вопросы рекрутеров и hiring manager.' },
          ].map((it) => (
            <div key={it.name}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.dot }} />
                <span className="text-[15px] font-semibold">{it.name}</span>
              </div>
              <p className="m-0 text-[13.5px] leading-relaxed text-text-secondary">{it.sub}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[13px] text-text-muted">
          Секции комбинируются в шаблонах интервью под конкретную компанию.
        </p>
      </section>

      <section id="pricing" className="mx-auto max-w-[1200px] border-t px-8 pb-28" style={{ borderColor: brand.hair }}>
        <div className="pt-16 text-center">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-text-muted">Тарифы</p>
          <h2 className="mt-3.5 text-[clamp(28px,3.4vw,36px)] font-semibold tracking-[-0.025em]">
            Free хватит, чтобы попробовать
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-relaxed text-text-secondary">
            Лимиты совпадают с billing service.{' '}
            <Link to="/pricing" className="text-text-primary underline">
              Подробнее о тарифах →
            </Link>
          </p>
        </div>
        <div className="pricing-grid mx-auto mt-12 grid max-w-[760px] gap-6 sm:grid-cols-2">
          {PLAN_CATALOG.map((plan) => (
            <div
              key={plan.slug}
              className="relative rounded-[18px] border bg-surface-1 p-7"
              style={{ borderColor: plan.highlight ? brand.hairStrong : brand.hair }}
            >
              {plan.highlight ? (
                <span className="absolute right-6 top-6 h-0.5 w-6 bg-danger" aria-hidden />
              ) : null}
              <div className="text-xl font-semibold">{plan.name}</div>
              <div className="mt-1.5 text-[13px] text-text-secondary">{plan.tagline}</div>
              <ul className="my-[22px] flex flex-col gap-2.5">
                {plan.highlights.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[13.5px] text-text-secondary">
                    <span className="text-text-primary">✓</span>
                    {line}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.slug === 'free' ? '/login' : '/pricing'}
                className="flex w-full items-center justify-center rounded-[10px] px-[18px] py-[11px] text-sm font-medium no-underline"
                style={{
                  background: plan.highlight ? brand.ink : 'transparent',
                  color: plan.highlight ? brand.bg : brand.ink,
                  border: plan.highlight ? 'none' : `1px solid ${brand.hair}`,
                }}
              >
                {plan.slug === 'free' ? 'Начать бесплатно' : 'Подробнее о Pro'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: brand.hair }}>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-6 px-8 py-10 pb-14">
          <div className="max-w-[420px]">
            <Link to="/welcome" className="no-underline">
              <span className="inline-flex items-center gap-2">
                <span className="h-[7px] w-[7px] rounded-full bg-danger" />
                <span className="text-sm font-medium">druz9.online</span>
              </span>
            </Link>
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-text-secondary">
              Mock-интервью и AI-разбор для подготовки к техническим собеседованиям.
            </p>
            <div className="mt-[18px] text-[12.5px] text-text-muted">© {new Date().getFullYear()} druz9.online</div>
          </div>
          <div className="flex gap-7 text-[13.5px] text-text-secondary">
            <a href="https://t.me/druz9" target="_blank" rel="noopener noreferrer" className="no-underline hover:text-text-primary">
              Telegram
            </a>
            <Link to="/legal/terms" className="no-underline hover:text-text-primary">
              Terms
            </Link>
            <Link to="/legal/privacy" className="no-underline hover:text-text-primary">
              Privacy
            </Link>
            <Link to="/login" className="no-underline hover:text-text-primary">
              Войти
            </Link>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 880px) {
          .hero-grid { gap: 48px !important; }
          .surfaces-grid { gap: 32px !important; }
          .surfaces-cells { grid-template-columns: 1fr !important; gap: 28px !important; }
          .tracks-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PublicPageShell>
  )
}

function Feature({ title, text, muted }: { title: string; text: string; muted?: boolean }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: muted ? 'rgba(15,15,15,0.25)' : brand.dot }}
        />
        <span className="text-[17px] font-semibold tracking-[-0.005em]">{title}</span>
      </div>
      <p className="m-0 max-w-[360px] text-[14.5px] leading-relaxed text-text-secondary">{text}</p>
    </div>
  )
}
