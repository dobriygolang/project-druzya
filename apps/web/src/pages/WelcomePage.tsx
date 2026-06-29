import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PublicNav, PublicPageShell } from '@/components/brand/PublicNav'
import { Logo } from '@/components/brand/Logo'
import { brand } from '@/lib/brand/tokens'
import { getBillingPlans } from '@/lib/api/billing'
import { readAccessToken } from '@/lib/apiClient'
import { WelcomeProductDemo } from '@/components/welcome/WelcomeProductDemo'
import { useI18n } from '@/lib/i18n'

function Bullet({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: brand.dot }} />
      {children}
    </span>
  )
}

export default function WelcomePage() {
  const { t } = useI18n()
  const isAuthed = !!readAccessToken()
  const plansQ = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.scrollBehavior
    html.style.scrollBehavior = 'smooth'
    html.classList.add('light')
    return () => {
      html.style.scrollBehavior = prev
    }
  }, [])

  const tracks = [
    { name: t('welcome.trackAlgo'), sub: t('welcome.trackAlgoSub') },
    { name: t('welcome.trackSys'), sub: t('welcome.trackSysSub') },
    { name: t('welcome.trackBeh'), sub: t('welcome.trackBehSub') },
  ]

  const primaryCtaTo = isAuthed ? '/today' : '/login'
  const primaryCtaLabel = isAuthed ? t('public.continue') : t('public.startFree')

  return (
    <PublicPageShell>
      <PublicNav />
      <section className="mx-auto max-w-[1200px] px-8 pb-24 pt-[88px]">
        <div className="hero-grid grid items-center gap-16 lg:grid-cols-2">
          <div className="welcome-hero-copy">
            <span className="sdvg-pill mb-7">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.dot }} />
              {t('welcome.pill')}
            </span>
            <h1 className="text-[clamp(40px,6vw,64px)] font-semibold leading-[1.02] tracking-[-0.035em]">
              {t('welcome.heroTitle')}
            </h1>
            <p className="mt-6 max-w-[460px] text-[17px] leading-relaxed text-text-secondary">
              {t('welcome.heroBody')}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link
                to={primaryCtaTo}
                className="inline-flex items-center rounded-[10px] px-[22px] py-3 text-[15px] font-medium no-underline"
                style={{ background: brand.ink, color: brand.bg }}
              >
                {primaryCtaLabel}
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-1.5 py-3 text-[15px] font-medium no-underline"
              >
                {t('welcome.howItWorks')}
              </a>
              <Link
                to="/live/new"
                className="inline-flex items-center gap-2 px-1.5 py-3 text-[15px] font-medium no-underline"
              >
                {t('welcome.heroLive')}
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-5">
              <Bullet>{t('welcome.bulletMocks')}</Bullet>
              <Bullet>{t('welcome.bulletToday')}</Bullet>
              <Bullet>
                <Link to="/live/new" className="text-inherit no-underline hover:text-text-primary">
                  {t('welcome.bulletLive')}
                </Link>
              </Bullet>
            </div>
          </div>
          <WelcomeProductDemo />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1200px] border-t px-8 pb-28 pt-16" style={{ borderColor: brand.hair }}>
        <div className="surfaces-grid grid items-start gap-16 lg:grid-cols-[1fr_2.4fr]">
          <div>
            <p className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-text-muted">
              {t('welcome.featuresEyebrow')}
            </p>
            <h2 className="mt-[18px] text-[clamp(28px,3.4vw,38px)] font-semibold leading-[1.1] tracking-[-0.025em]">
              {t('welcome.featuresTitle')}
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-text-secondary">{t('welcome.featuresBody')}</p>
          </div>
          <div className="surfaces-cells grid gap-x-14 gap-y-12 sm:grid-cols-2">
            <Feature title={t('welcome.featMockTitle')} text={t('welcome.featMockText')} />
            <Feature title={t('welcome.featAiTitle')} text={t('welcome.featAiText')} />
            <Feature muted title={t('welcome.featTodayTitle')} text={t('welcome.featTodayText')} />
            <Feature muted title={t('welcome.featLiveTitle')} text={t('welcome.featLiveText')}>
              <Link to="/live/new" className="mt-3 inline-block text-[13.5px] font-medium text-text-primary no-underline hover:underline">
                {t('welcome.featLiveCta')}
              </Link>
            </Feature>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-8 pb-28">
        <div className="tracks-grid grid gap-8 rounded-[18px] border bg-surface-1 p-8 sm:grid-cols-3" style={{ borderColor: brand.hair }}>
          {tracks.map((it) => (
            <div key={it.name}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.dot }} />
                <span className="text-[15px] font-semibold">{it.name}</span>
              </div>
              <p className="m-0 text-[13.5px] leading-relaxed text-text-secondary">{it.sub}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[13px] text-text-muted">{t('welcome.tracksNote')}</p>
      </section>

      <section id="pricing" className="mx-auto max-w-[1200px] border-t px-8 pb-28" style={{ borderColor: brand.hair }}>
        <div className="pt-16 text-center">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-text-muted">
            {t('welcome.pricingEyebrow')}
          </p>
          <h2 className="mt-3.5 text-[clamp(28px,3.4vw,36px)] font-semibold tracking-[-0.025em]">
            {t('welcome.pricingTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-relaxed text-text-secondary">
            {t('welcome.pricingBody')}
          </p>
        </div>
        <div className="pricing-grid mx-auto mt-12 grid max-w-[760px] gap-6 sm:grid-cols-2">
          {plansQ.isLoading ? (
            <>
              <div className="h-[280px] animate-pulse rounded-[18px] bg-surface-2" />
              <div className="h-[280px] animate-pulse rounded-[18px] bg-surface-2" />
            </>
          ) : null}
          {(plansQ.data?.plans ?? []).map((plan) => {
            const ctaTo =
              plan.slug === 'free'
                ? isAuthed
                  ? '/today'
                  : '/login'
                : isAuthed
                  ? '/pricing'
                  : '/login?next=/pricing'
            const ctaLabel =
              plan.slug === 'free'
                ? isAuthed
                  ? t('public.continue')
                  : t('public.startFree')
                : isAuthed
                  ? t('pricing.subscribeCta')
                  : t('pricing.loginForPro')

            return (
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
                  to={ctaTo}
                  className="flex w-full items-center justify-center rounded-[10px] px-[18px] py-[11px] text-sm font-medium no-underline"
                  style={{
                    background: plan.highlight ? brand.ink : 'transparent',
                    color: plan.highlight ? brand.bg : brand.ink,
                    border: plan.highlight ? 'none' : `1px solid ${brand.hair}`,
                  }}
                >
                  {ctaLabel}
                </Link>
              </div>
            )
          })}
        </div>
        <p className="mt-6 text-center text-[13px] text-text-muted">
          <Link to="/pricing" className="text-text-primary underline">
            {t('welcome.pricingMore')}
          </Link>
        </p>
      </section>

      <footer className="border-t" style={{ borderColor: brand.hair }}>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-6 px-8 py-10 pb-14">
          <div className="max-w-[420px]">
            <Logo to="/welcome" size="sm" />
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-text-secondary">
              {t('welcome.footerTagline')}
            </p>
            <div className="mt-[18px] text-[12.5px] text-text-muted">© {new Date().getFullYear()} druz9.online</div>
          </div>
          <div className="flex gap-7 text-[13.5px] text-text-secondary">
            <a href="https://t.me/gogymtrip" target="_blank" rel="noopener noreferrer" className="no-underline hover:text-text-primary">
              Telegram
            </a>
            <Link to="/legal/terms" className="no-underline hover:text-text-primary">
              {t('public.terms')}
            </Link>
            <Link to="/legal/privacy" className="no-underline hover:text-text-primary">
              {t('public.privacy')}
            </Link>
            <Link to="/live/new" className="no-underline hover:text-text-primary">
              {t('public.liveCoding')}
            </Link>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes welcome-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .welcome-hero-copy {
          animation: welcome-fade-up 0.6s ease-out both;
        }
        @media (max-width: 880px) {
          .hero-grid { gap: 48px !important; }
          .surfaces-grid { gap: 32px !important; }
          .surfaces-cells { grid-template-columns: 1fr !important; gap: 28px !important; }
          .tracks-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-hero-copy {
            animation: none !important;
          }
        }
      `}</style>
    </PublicPageShell>
  )
}

function Feature({
  title,
  text,
  muted,
  children,
}: {
  title: string
  text: string
  muted?: boolean
  children?: ReactNode
}) {
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
      {children}
    </div>
  )
}
