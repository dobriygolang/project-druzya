import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CompanyCard } from '@/components/mock/CompanyCard'
import { ErrorMessage } from '@/components/ErrorMessage'
import { getBillingMe } from '@/lib/api/billing'
import { listCompanies, listInterviewTemplates } from '@/lib/api/content'
import { startSession, startTrainingSession } from '@/lib/api/interview'
import { formatApiError } from '@/lib/apiClient'
import { formatLimitUsage } from '@/lib/billingLabels'
import type { Company, InterviewTemplate, SessionMode } from '@/lib/types'

const SOLO_SECTIONS = [
  {
    id: 'algo',
    label: 'Algo',
    hint: 'Data structures & algorithms',
    mode: 'SESSION_MODE_ALGORITHMS_TRAINING' as SessionMode,
  },
  {
    id: 'coding',
    label: 'Coding',
    hint: 'Live coding & SQL',
    mode: 'SESSION_MODE_LIVE_CODING_TRAINING' as SessionMode,
  },
  {
    id: 'sysdesign',
    label: 'System Design',
    hint: 'Architecture & scaling',
    mode: 'SESSION_MODE_SYSTEM_DESIGN_TRAINING' as SessionMode,
  },
  {
    id: 'behavioral',
    label: 'Behavioral',
    hint: 'STAR & culture fit',
    mode: 'SESSION_MODE_BEHAVIORAL_TRAINING' as SessionMode,
  },
] as const

export default function MockHubPage() {
  const navigate = useNavigate()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  const companiesQ = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies() })
  const templatesQ = useQuery({
    queryKey: ['templates', selectedCompanyId],
    queryFn: () => listInterviewTemplates(selectedCompanyId ?? undefined),
    enabled: !!selectedCompanyId,
  })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })

  const startMockM = useMutation({
    mutationFn: (templateId: string) => startSession(templateId),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  const startSoloM = useMutation({
    mutationFn: (mode: SessionMode) => startTrainingSession(mode),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  const companyTemplatesEnabled = billingQ.data?.features.company_templates_enabled !== false
  const mockQuota = billingQ.data?.limits.mock_interviews_per_month
  const mockQuotaExhausted =
    mockQuota != null &&
    !mockQuota.unlimited &&
    mockQuota.limit != null &&
    mockQuota.used >= mockQuota.limit

  const companies = companiesQ.data?.companies ?? []
  const templates = templatesQ.data?.templates ?? []
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)

  const canStartCompanyMock =
    companyTemplatesEnabled && !mockQuotaExhausted && !startMockM.isPending

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8 lg:px-20 lg:py-8">
      <header className="flex flex-col gap-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">
          Mock Interview
        </div>
        <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">
          Mock & practice
        </h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Company mock — секции из шаблона content service. Solo — одна тренировочная секция за
          сессию.
        </p>
      </header>

      <FirstRunSteps />

      <section className="rounded-xl border border-border bg-surface-1 p-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          Solo practice
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Одна секция → одна training-сессия на interview service.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SOLO_SECTIONS.map((s) => (
            <Button
              key={s.id}
              variant="ghost"
              size="sm"
              title={s.hint}
              loading={startSoloM.isPending && startSoloM.variables === s.mode}
              disabled={mockQuotaExhausted || startSoloM.isPending}
              onClick={() => startSoloM.mutate(s.mode)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface-1 p-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          Live collab
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Pair programming — комната создаётся через rooms service.
        </p>
        <Link to="/live/new" className="mt-3 inline-block">
          <Button variant="ghost" size="sm" icon={<Users className="h-4 w-4" />}>
            Создать live room
          </Button>
        </Link>
      </section>

      {!companyTemplatesEnabled && billingQ.isSuccess ? (
        <QuotaBanner>
          Шаблоны компаний доступны на Pro.{' '}
          <Link to="/pricing" className="underline">
            Тарифы
          </Link>
        </QuotaBanner>
      ) : null}

      {mockQuotaExhausted && billingQ.isSuccess && mockQuota ? (
        <QuotaBanner>
          {formatLimitUsage('mock_interviews_per_month', mockQuota)} — лимит исчерпан.
        </QuotaBanner>
      ) : null}

      {startMockM.isError || startSoloM.isError ? (
        <ErrorMessage
          message={formatApiError(startMockM.error ?? startSoloM.error)}
          onRetry={() => {
            startMockM.reset()
            startSoloM.reset()
          }}
        />
      ) : null}

      <section>
        <h2 className="font-display text-lg font-bold">Компании</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Выбери компанию → шаблон интервью → multi-section mock с backend.
        </p>

        {companiesQ.isLoading ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : null}

        {companiesQ.isError ? (
          <div className="mt-4">
            <ErrorMessage
              message={formatApiError(companiesQ.error)}
              onRetry={() => void companiesQ.refetch()}
            />
          </div>
        ) : null}

        {companiesQ.isSuccess && companies.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">Каталог пуст — запусти seed content service.</p>
        ) : null}

        {companiesQ.isSuccess && companies.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {companies.map((c) => (
              <CompanyCard
                key={c.id}
                id={c.id}
                name={c.name}
                slug={c.slug}
                description={c.description}
                onSelect={(id) => setSelectedCompanyId(id)}
                loading={selectedCompanyId === c.id && templatesQ.isFetching}
                selected={selectedCompanyId === c.id}
              />
            ))}
          </div>
        ) : null}
      </section>

      {selectedCompanyId ? (
        <TemplatePicker
          company={selectedCompany}
          templates={templates}
          loading={templatesQ.isLoading}
          error={templatesQ.isError ? formatApiError(templatesQ.error) : null}
          onRetry={() => void templatesQ.refetch()}
          onClear={() => setSelectedCompanyId(null)}
          onStart={(templateId) => startMockM.mutate(templateId)}
          starting={startMockM.isPending}
          disabled={!canStartCompanyMock}
        />
      ) : null}
    </div>
  )
}

function TemplatePicker({
  company,
  templates,
  loading,
  error,
  onRetry,
  onClear,
  onStart,
  starting,
  disabled,
}: {
  company?: Company
  templates: InterviewTemplate[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onClear: () => void
  onStart: (templateId: string) => void
  starting: boolean
  disabled: boolean
}) {
  const [pickedId, setPickedId] = useState<string | null>(null)

  const picked = useMemo(
    () => templates.find((t) => t.id === pickedId) ?? null,
    [templates, pickedId],
  )

  return (
    <section className="rounded-xl border border-border-strong bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">
            {company?.name ?? 'Шаблоны'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Секции и задачи задаются шаблоном в content service.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Сменить компанию
        </Button>
      </div>

      {loading ? <p className="mt-4 text-sm text-text-muted">Загрузка шаблонов…</p> : null}

      {error ? (
        <div className="mt-4">
          <ErrorMessage message={error} onRetry={onRetry} />
        </div>
      ) : null}

      {!loading && !error && templates.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">Нет активных шаблонов для этой компании.</p>
      ) : null}

      {templates.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {templates.map((t) => {
            const active = pickedId === t.id
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setPickedId(t.id)}
                  className={[
                    'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                    active
                      ? 'border-text-primary bg-text-primary/5'
                      : 'border-border bg-surface-2 hover:border-border-strong',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                      active ? 'border-text-primary bg-text-primary text-bg' : 'border-border',
                    ].join(' ')}
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-text-primary">{t.title}</span>
                    {t.description ? (
                      <span className="mt-1 block text-xs text-text-secondary">{t.description}</span>
                    ) : null}
                    {t.target_level ? (
                      <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wide text-text-muted">
                        {t.target_level}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {picked ? (
        <Button
          className="mt-4"
          loading={starting}
          disabled={disabled || !pickedId}
          onClick={() => onStart(picked.id)}
        >
          Начать mock — {picked.title}
        </Button>
      ) : null}
    </section>
  )
}

function QuotaBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pl-3 text-sm text-text-primary">
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[1.5px]"
        style={{ background: 'var(--red)' }}
      />
      {children}
    </div>
  )
}

function FirstRunSteps() {
  const steps = [
    { n: '1', title: 'Компания', body: 'Выбери компанию из каталога content.' },
    { n: '2', title: 'Шаблон', body: 'Секции (algo, SD, …) — из interview-template.' },
    { n: '3', title: 'AI-разбор', body: 'Оценка попыток через ai + recommendation.' },
  ]
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
        Как это работает
      </span>
      <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-text-primary/10 font-display text-sm font-bold text-text-primary">
              {s.n}
            </span>
            <span className="font-display text-sm font-bold text-text-primary">{s.title}</span>
            <span className="text-xs text-text-secondary">{s.body}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
