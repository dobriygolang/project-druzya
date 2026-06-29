import { useEffect, useState } from 'react'
import { brand } from '@/lib/brand/tokens'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

const STEP_COUNT = 3
const AUTO_MS = 4500

function DemoRecCard({
  title,
  sub,
  accent,
  muted,
  highlight,
}: {
  title: string
  sub: string
  accent?: boolean
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-transparent pl-3.5 transition-colors',
        highlight && 'border-[rgba(76,179,92,0.35)] bg-[rgba(76,179,92,0.06)] py-2 pr-2',
      )}
    >
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

function MockStep() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[220px] flex-col">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{t('welcome.demo.mockEyebrow')}</p>
      <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.01em]">{t('welcome.demo.mockQuestion')}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{t('welcome.demo.mockHint')}</p>
      <pre
        className="mt-4 overflow-x-auto rounded-lg border px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-text-primary"
        style={{ borderColor: brand.hair, background: 'rgba(15,15,15,0.03)' }}
      >
        {`def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        ...`}
      </pre>
      <div className="mt-auto pt-4">
        <span
          className="inline-flex rounded-[9px] px-3.5 py-2 text-[13px] font-medium"
          style={{ background: brand.ink, color: brand.bg }}
        >
          {t('welcome.demo.mockSubmit')}
        </span>
      </div>
    </div>
  )
}

function AiStep() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[220px] flex-col">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{t('welcome.demo.aiEyebrow')}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[32px] font-semibold tabular-nums leading-none tracking-[-0.03em]">68</span>
        <span className="text-sm text-text-muted">/ 100</span>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">{t('welcome.demo.aiFeedback')}</p>
      <div
        className="mt-4 rounded-lg border px-3 py-2.5"
        style={{ borderColor: brand.hair, background: 'rgba(245,166,35,0.08)' }}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{t('welcome.demo.aiWeakLabel')}</p>
        <p className="mt-1 text-[14px] font-medium">{t('welcome.demo.aiWeak')}</p>
      </div>
      <p className="mt-auto pt-4 text-[12.5px] text-text-muted">{t('welcome.demo.aiNote')}</p>
    </div>
  )
}

function TodayStep({ reducedMotion }: { reducedMotion: boolean }) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-[220px] flex-col">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-text-secondary">{t('welcome.demo.todayReadiness')}</span>
        <span className="text-[28px] font-semibold tabular-nums tracking-[-0.02em]">68%</span>
      </div>
      <div className="relative mt-3 h-1 overflow-hidden rounded-sm bg-[rgba(76,179,92,0.2)]">
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-sm',
            !reducedMotion && 'welcome-demo-bar-grow',
          )}
          style={{ width: reducedMotion ? '68%' : '62%', background: brand.green }}
        />
      </div>
      <p className="mb-2.5 mt-5 text-[13px] text-text-secondary">
        {t('welcome.demo.todayPlan')} <span className="text-text-muted">3</span>
      </p>
      <DemoRecCard
        title={t('welcome.demo.todayTaskNew')}
        sub={t('welcome.demo.todayTaskNewSub')}
        accent
        highlight
      />
      <div className="h-2" />
      <DemoRecCard title={t('welcome.demo.todayTask2')} sub={t('welcome.demo.todayTask2Sub')} muted />
    </div>
  )
}

export function WelcomeProductDemo() {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const stepLabels = [t('welcome.demo.stepMock'), t('welcome.demo.stepAi'), t('welcome.demo.stepToday')]

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (paused || reducedMotion) return
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STEP_COUNT)
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [paused, reducedMotion])

  return (
    <div
      className="welcome-product-demo relative rounded-[18px] border bg-surface-1 p-6"
      style={{ borderColor: brand.hair, boxShadow: brand.cardShadow }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false)
      }}
      role="region"
      aria-label={t('welcome.demo.ariaLabel')}
    >
      <div className="absolute right-[22px] top-[18px] flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[9px] w-[9px] rounded-full bg-black/10" />
        ))}
      </div>

      <div key={step} className="welcome-demo-step">
        {step === 0 ? <MockStep /> : null}
        {step === 1 ? <AiStep /> : null}
        {step === 2 ? <TodayStep reducedMotion={reducedMotion} /> : null}
      </div>

      <div className="mt-5 border-t pt-4" style={{ borderColor: brand.hair }}>
        <div className="flex items-center justify-center gap-2" role="tablist" aria-label={t('welcome.demo.stepsAria')}>
          {stepLabels.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={step === i}
              aria-label={label}
              onClick={() => setStep(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                step === i ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-secondary',
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{ background: step === i ? brand.green : 'rgba(15,15,15,0.2)' }}
              />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[12px] text-text-muted">{t('welcome.demo.caption')}</p>
      </div>

      <style>{`
        @keyframes welcome-demo-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .welcome-product-demo {
          animation: welcome-demo-fade 0.6s ease-out 0.12s both;
        }
        .welcome-demo-step {
          animation: welcome-demo-fade 0.35s ease-out both;
        }
        @keyframes welcome-demo-bar {
          from { width: 62%; }
          to { width: 68%; }
        }
        .welcome-demo-bar-grow {
          animation: welcome-demo-bar 0.9s ease-out 0.2s both;
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-product-demo, .welcome-demo-step, .welcome-demo-bar-grow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
