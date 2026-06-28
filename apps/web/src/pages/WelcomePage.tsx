import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { readAccessToken } from '@/lib/apiClient'

/**
 * Public landing — sdvg.io-style minimalism from the legacy druz9 frontend,
 * updated for the new backend (mock interviews, AI eval, dashboard, live rooms).
 */

const BG = '#FAFAF8'
const INK = '#0F0F0F'
const INK_60 = '#5B5B5B'
const INK_40 = '#8E8E8E'
const HAIR = 'rgba(15,15,15,0.08)'
const DOT = '#FF3B30'

function Logo({ size = 14 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{ width: 7, height: 7, borderRadius: 999, background: DOT, display: 'inline-block' }}
      />
      <span style={{ fontSize: size, fontWeight: 500, letterSpacing: '-0.005em', color: INK }}>
        druz9.online
      </span>
    </span>
  )
}

function Nav() {
  const isAuthed = !!readAccessToken()
  return (
    <header style={{ background: BG, borderBottom: `1px solid ${HAIR}` }}>
      <div
        className="nav-row"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          gap: 12,
        }}
      >
        <Link to="/welcome" style={{ textDecoration: 'none', flex: '0 0 auto' }}>
          <Logo />
        </Link>
        <nav className="nav-center" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <a href="#features" style={{ fontSize: 14, color: INK_60, textDecoration: 'none' }}>
            Возможности
          </a>
          <a href="#pricing" style={{ fontSize: 14, color: INK_60, textDecoration: 'none' }}>
            Тарифы
          </a>
          <a
            href="https://t.me/druz9"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, color: INK_60, textDecoration: 'none' }}
          >
            Канал
          </a>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
          {isAuthed ? (
            <Link
              to="/dashboard"
              style={{
                fontSize: 14,
                fontWeight: 500,
                padding: '8px 14px',
                borderRadius: 8,
                background: INK,
                color: BG,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              В приложение
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="nav-login"
                style={{ fontSize: 14, color: INK_60, textDecoration: 'none' }}
              >
                Войти
              </Link>
              <Link
                to="/login"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: INK,
                  color: BG,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Начать бесплатно
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function DashboardMock() {
  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${HAIR}`,
        borderRadius: 18,
        padding: 24,
        background: '#fff',
        boxShadow: '0 1px 0 rgba(15,15,15,0.02), 0 24px 60px -32px rgba(15,15,15,0.18)',
      }}
    >
      <div style={{ position: 'absolute', top: 18, right: 22, display: 'flex', gap: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: 'rgba(15,15,15,0.1)' }} />
        <span style={{ width: 9, height: 9, borderRadius: 999, background: 'rgba(15,15,15,0.1)' }} />
        <span style={{ width: 9, height: 9, borderRadius: 999, background: 'rgba(15,15,15,0.1)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 13, color: INK_60 }}>Readiness</span>
        <span style={{ fontSize: 28, fontWeight: 600, color: INK, letterSpacing: '-0.02em' }}>68%</span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'rgba(76,179,92,0.2)',
          marginBottom: 22,
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '68%',
            background: '#4CB35C',
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ fontSize: 13, color: INK_60, marginBottom: 10 }}>
        Рекомендации <span style={{ color: INK_40 }}> 2</span>
      </div>
      <RecCard
        title="Повторить dynamic programming"
        sub="Слабое место после mock-сессии"
        accent
      />
      <div style={{ height: 10 }} />
      <RecCard title="System design: rate limiter" sub="Следующий шаг в плане" muted />
    </div>
  )
}

function RecCard({ title, sub, accent, muted }: { title: string; sub: string; accent?: boolean; muted?: boolean }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 14 }}>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 6,
          bottom: 6,
          width: 2,
          borderRadius: 2,
          background: accent ? '#4CB35C' : muted ? '#E8B548' : 'rgba(15,15,15,0.18)',
        }}
      />
      <div style={{ fontSize: 14.5, fontWeight: 500, color: INK }}>{title}</div>
      <div style={{ fontSize: 12.5, color: INK_40, marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function Hero() {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 32px 96px' }}>
      <div
        className="hero-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          gap: 64,
          alignItems: 'center',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              borderRadius: 999,
              border: `1px solid ${HAIR}`,
              fontSize: 12.5,
              color: INK_60,
              marginBottom: 28,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: DOT }} />
            Подготовка к техническим собесам
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(40px, 6vw, 64px)',
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
              color: INK,
            }}
          >
            Mock-интервью с AI-разбором — без шума и геймификации.
          </h1>
          <p
            style={{
              margin: '24px 0 0',
              fontSize: 17,
              lineHeight: 1.55,
              color: INK_60,
              maxWidth: 460,
            }}
          >
            Компании и шаблоны интервью, алгоритмы, system design и behavioral. После каждой
            попытки — оценка и персональный план, что повторить.
          </p>
          <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '12px 22px',
                borderRadius: 10,
                background: INK,
                color: BG,
                fontSize: 15,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Начать бесплатно
            </Link>
            <a
              href="#features"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 6px',
                color: INK,
                fontSize: 15,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Как это работает →
            </a>
          </div>
          <div style={{ marginTop: 28, display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13, color: INK_60 }}>
            <Bullet>2 mock-интервью в месяц бесплатно</Bullet>
            <Bullet>AI-оценка ответов</Bullet>
            <Bullet>Live coding с напарником</Bullet>
          </div>
        </div>
        <div>
          <DashboardMock />
        </div>
      </div>
    </section>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: DOT }} />
      <span>{children}</span>
    </span>
  )
}

function Features() {
  return (
    <section
      id="features"
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '64px 32px 112px',
        borderTop: `1px solid ${HAIR}`,
      }}
    >
      <div
        className="surfaces-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2.4fr',
          gap: 64,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11.5,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: INK_40,
              marginBottom: 18,
            }}
          >
            Что внутри
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(28px, 3.4vw, 38px)',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              color: INK,
            }}
          >
            Четыре блока. Один аккаунт.
          </h2>
          <p style={{ margin: '20px 0 0', fontSize: 15, color: INK_60, lineHeight: 1.6 }}>
            Всё для подготовки к собесу в одном месте: от mock-сессии до совместного live coding.
          </p>
        </div>
        <div
          className="surfaces-cells"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '48px 56px',
          }}
        >
          <Feature
            title="Mock-интервью"
            text="Шаблоны под компании: алгоритмы, SQL, system design и behavioral в одной сессии."
          />
          <Feature
            title="AI-разбор"
            text="После каждой попытки — оценка, фидбек и задачи на повтор. Без «молодец, попробуй ещё»."
          />
          <Feature
            muted
            title="Дашборд"
            text="Readiness, сильные и слабые навыки, рекомендации и учебный план на основе попыток."
          />
          <Feature
            muted
            title="Live coding"
            text="Комнаты для совместного решения задач в реальном времени — для парной практики."
          />
        </div>
      </div>
    </section>
  )
}

function Feature({ title, text, muted }: { title: string; text: string; muted?: boolean }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: muted ? 'rgba(15,15,15,0.25)' : DOT,
          }}
        />
        <span style={{ fontSize: 17, fontWeight: 600, color: INK, letterSpacing: '-0.005em' }}>
          {title}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, color: INK_60, lineHeight: 1.6, maxWidth: 360 }}>{text}</p>
    </div>
  )
}

function ModesStrip() {
  const items = [
    {
      name: 'Алгоритмы',
      sub: 'LeetCode-style задачи с запуском кода, тестами и AI-оценкой решения.',
    },
    {
      name: 'System design',
      sub: 'Архитектурные кейсы: масштабирование, trade-offs, диаграммы и устный разбор.',
    },
    {
      name: 'Behavioral',
      sub: 'STAR-ответы, soft skills и типовые вопросы рекрутеров и hiring manager.',
    },
  ]
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px 112px' }}>
      <div
        style={{
          border: `1px solid ${HAIR}`,
          borderRadius: 18,
          padding: 32,
          background: '#fff',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 32,
        }}
        className="tracks-grid"
      >
        {items.map((it) => (
          <div key={it.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: DOT }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>{it.name}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: INK_60, lineHeight: 1.55 }}>{it.sub}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: INK_40, textAlign: 'center' }}>
        Секции комбинируются в шаблонах интервью под конкретную компанию.
      </div>
    </section>
  )
}

const PLANS = [
  {
    slug: 'free',
    name: 'Free',
    tagline: 'Попробовать без оплаты',
    cta: 'Начать бесплатно',
    ctaTo: '/login',
    highlight: false,
    limits: [
      '5 AI-оценок в день',
      '2 mock-интервью в месяц',
      '30 запусков кода в день',
      'Базовые шаблоны',
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    tagline: 'Для плотной подготовки',
    cta: 'Подключить Pro',
    ctaTo: '/login?next=/profile',
    highlight: true,
    limits: [
      '100 AI-оценок в день',
      '30 mock-интервью в месяц',
      '500 запусков кода в день',
      'Шаблоны компаний и скрытые тесты',
      'Расширенный AI-фидбек',
    ],
  },
] as const

function Pricing() {
  return (
    <section
      id="pricing"
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 32px 112px',
        borderTop: `1px solid ${HAIR}`,
      }}
    >
      <div style={{ paddingTop: 64, textAlign: 'center', marginBottom: 48 }}>
        <div
          style={{
            fontSize: 11.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: INK_40,
            marginBottom: 14,
          }}
        >
          Тарифы
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(28px, 3.4vw, 36px)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: INK,
          }}
        >
          Free хватит, чтобы попробовать
        </h2>
        <p style={{ margin: '16px auto 0', fontSize: 15, color: INK_60, maxWidth: 480, lineHeight: 1.55 }}>
          Pro подключается через Tribute. Без trial-ловушек — отмена в любой момент, доступ до конца
          оплаченного периода.
        </p>
      </div>
      <div
        className="pricing-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        {PLANS.map((plan) => (
          <div
            key={plan.slug}
            style={{
              border: `1px solid ${plan.highlight ? 'rgba(15,15,15,0.18)' : HAIR}`,
              borderRadius: 18,
              padding: 28,
              background: '#fff',
              position: 'relative',
            }}
          >
            {plan.highlight ? (
              <span
                style={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  width: 24,
                  height: 2,
                  background: DOT,
                }}
              />
            ) : null}
            <div style={{ fontSize: 20, fontWeight: 600, color: INK }}>{plan.name}</div>
            <div style={{ fontSize: 13, color: INK_60, marginTop: 6 }}>{plan.tagline}</div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '22px 0 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {plan.limits.map((line) => (
                <li
                  key={line}
                  style={{ fontSize: 13.5, color: INK_60, display: 'flex', alignItems: 'flex-start', gap: 10 }}
                >
                  <span style={{ color: INK, marginTop: 2 }}>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link
              to={plan.ctaTo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '11px 18px',
                borderRadius: 10,
                background: plan.highlight ? INK : 'transparent',
                color: plan.highlight ? BG : INK,
                border: plan.highlight ? 'none' : `1px solid ${HAIR}`,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${HAIR}` }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 32px 56px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <Logo />
          <p style={{ margin: '14px 0 0', fontSize: 13.5, color: INK_60, lineHeight: 1.55 }}>
            Mock-интервью и AI-разбор для подготовки к техническим собеседованиям.
          </p>
          <div style={{ marginTop: 18, fontSize: 12.5, color: INK_40 }}>
            © {new Date().getFullYear()} druz9.online
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, fontSize: 13.5 }}>
          <a href="https://t.me/druz9" target="_blank" rel="noopener noreferrer" style={footerLink}>
            Telegram
          </a>
          <Link to="/login" style={footerLink}>
            Войти
          </Link>
        </div>
      </div>
    </footer>
  )
}

const footerLink: CSSProperties = { color: INK_60, textDecoration: 'none' }

export default function WelcomePage() {
  useEffect(() => {
    const html = document.documentElement
    const prevScroll = html.style.scrollBehavior
    html.style.scrollBehavior = 'smooth'
    return () => {
      html.style.scrollBehavior = prevScroll
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: INK,
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <style>{`
        @media (max-width: 880px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .surfaces-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .surfaces-cells { grid-template-columns: 1fr !important; gap: 28px !important; }
          .tracks-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .nav-center { display: none !important; }
          .nav-row { padding: 16px 18px !important; }
        }
        @media (max-width: 420px) {
          .nav-login { display: none !important; }
        }
      `}</style>
      <Nav />
      <Hero />
      <Features />
      <ModesStrip />
      <Pricing />
      <Footer />
    </div>
  )
}
