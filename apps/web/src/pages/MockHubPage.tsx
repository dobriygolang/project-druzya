import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Users } from 'lucide-react'
import { PageHeader, SdvgCard } from '@/components/brand/SdvgCard'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { getBillingMe } from '@/lib/api/billing'
import { listCompanies, listInterviewTemplates } from '@/lib/api/content'
import { startSession, startTrainingSession } from '@/lib/api/interview'
import { formatApiError, readAccessToken } from '@/lib/apiClient'
import { formatLimitUsage } from '@/lib/billingLabels'
import { LIVE_LANGS } from '@/lib/live/constants'
import { readGuestDisplayName, persistGuestDisplayName } from '@/lib/live/guestDisplayName'
import { useCreateLiveRoom } from '@/lib/live/useCreateLiveRoom'
import type { Company, InterviewTemplate, SessionMode } from '@/lib/types'
import { cn } from '@/lib/cn'

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
  const authed = !!readAccessToken()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [liveLanguage, setLiveLanguage] = useState('go')
  const [guestName, setGuestName] = useState(() => readGuestDisplayName())

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

  const createLiveM = useCreateLiveRoom()

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

  const anyError =
    startMockM.error ?? startSoloM.error ?? createLiveM.error ?? companiesQ.error

  function handleCreateLive() {
    if (!authed) persistGuestDisplayName(guestName || 'Guest')
    createLiveM.mutate({
      language: liveLanguage,
      displayName: guestName || undefined,
    })
  }

  return (
    <PageContent wide className="gap-8">
      <PageHeader
        eyebrow="Practice"
        title="Mock & practice"
        description="Три формата подготовки — выбери режим и начинай сразу."
      />

      {mockQuotaExhausted && billingQ.isSuccess && mockQuota ? (
        <QuotaBanner>
          {formatLimitUsage('mock_interviews_per_month', mockQuota)} — лимит исчерпан.
        </QuotaBanner>
      ) : null}

      {anyError ? (
        <ErrorMessage
          message={formatApiError(anyError)}
          onRetry={() => {
            startMockM.reset()
            startSoloM.reset()
            createLiveM.reset()
            void companiesQ.refetch()
          }}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <PracticeCard
          eyebrow="Solo"
          title="Одна секция"
          description="Быстрая тренировка — algo, coding, system design или behavioral."
        >
          <div className="flex flex-wrap gap-2">
            {SOLO_SECTIONS.map((s) => (
              <PillButton
                key={s.id}
                title={s.hint}
                loading={startSoloM.isPending && startSoloM.variables === s.mode}
                disabled={mockQuotaExhausted || startSoloM.isPending}
                onClick={() => startSoloM.mutate(s.mode)}
              >
                {s.label}
              </PillButton>
            ))}
          </div>
        </PracticeCard>

        <PracticeCard
          eyebrow="Live"
          title="Pair programming"
          description="Общий редактор в реальном времени — комната создаётся сразу."
        >
          <div className="flex flex-col gap-4">
            {!authed ? (
              <label className="block">
                <span className="text-[13px] text-text-secondary">Ваше имя в редакторе</span>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest"
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
                />
              </label>
            ) : null}

            <div>
              <span className="text-[13px] text-text-secondary">Язык</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {LIVE_LANGS.map((lang) => (
                  <PillButton
                    key={lang.id}
                    active={liveLanguage === lang.id}
                    onClick={() => setLiveLanguage(lang.id)}
                  >
                    {lang.label}
                  </PillButton>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              icon={<Users className="h-4 w-4" />}
              iconRight={<ArrowRight className="h-4 w-4" />}
              loading={createLiveM.isPending}
              onClick={handleCreateLive}
            >
              Создать комнату
            </Button>
          </div>
        </PracticeCard>

        <PracticeCard
          eyebrow="Company"
          title="Mock под компанию"
          description="Полное интервью по шаблону — несколько секций под выбранную компанию."
        >
          {!companyTemplatesEnabled && billingQ.isSuccess ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Доступно на Pro.{' '}
              <Link to="/pricing" className="text-text-primary underline">
                Тарифы
              </Link>
            </p>
          ) : companiesQ.isLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <p className="text-[13px] text-text-muted">Каталог компаний пока пуст.</p>
          ) : (
            <CompanyMockPanel
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              selectedCompany={selectedCompany}
              templates={templates}
              templatesLoading={templatesQ.isLoading || templatesQ.isFetching}
              onSelectCompany={(id) =>
                setSelectedCompanyId((prev) => (prev === id ? null : id))
              }
              onStart={(templateId) => startMockM.mutate(templateId)}
              starting={startMockM.isPending}
              disabled={!canStartCompanyMock || mockQuotaExhausted}
            />
          )}
        </PracticeCard>
      </div>
    </PageContent>
  )
}

function PracticeCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <SdvgCard eyebrow={eyebrow} title={title} description={description} className="flex h-full flex-col">
      <div className="mt-auto">{children}</div>
    </SdvgCard>
  )
}

function PillButton({
  children,
  active,
  loading,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  loading?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-border-strong bg-surface-2 font-medium text-text-primary'
          : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary',
      )}
    >
      {loading ? '…' : children}
    </button>
  )
}

function CompanyMockPanel({
  companies,
  selectedCompanyId,
  selectedCompany,
  templates,
  templatesLoading,
  onSelectCompany,
  onStart,
  starting,
  disabled,
}: {
  companies: Company[]
  selectedCompanyId: string | null
  selectedCompany?: Company
  templates: InterviewTemplate[]
  templatesLoading: boolean
  onSelectCompany: (id: string) => void
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {companies.map((c) => (
          <PillButton
            key={c.id}
            active={selectedCompanyId === c.id}
            loading={selectedCompanyId === c.id && templatesLoading}
            onClick={() => {
              onSelectCompany(c.id)
              setPickedId(null)
            }}
          >
            {c.name}
          </PillButton>
        ))}
      </div>

      {selectedCompanyId ? (
        <div className="rounded-xl border border-border bg-surface-2/50 p-3">
          {templatesLoading ? (
            <p className="text-[13px] text-text-muted">Загрузка шаблонов…</p>
          ) : templates.length === 0 ? (
            <p className="text-[13px] text-text-muted">
              Нет шаблонов для {selectedCompany?.name ?? 'компании'}.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-text-secondary">
                Шаблон для {selectedCompany?.name}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {templates.map((t) => {
                  const active = pickedId === t.id
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setPickedId(t.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                          active
                            ? 'border-border-strong bg-surface-1'
                            : 'border-transparent hover:border-border hover:bg-surface-1',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                            active
                              ? 'border-text-primary bg-text-primary text-bg'
                              : 'border-border',
                          )}
                        >
                          {active ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {picked ? (
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  loading={starting}
                  disabled={disabled}
                  onClick={() => onStart(picked.id)}
                >
                  Начать — {picked.title}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-text-muted">Выберите компанию выше.</p>
      )}
    </div>
  )
}

function QuotaBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pl-3.5 text-sm text-text-primary">
      <span
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-0.5 rounded-full"
        style={{ background: brand.dot }}
      />
      {children}
    </div>
  )
}
