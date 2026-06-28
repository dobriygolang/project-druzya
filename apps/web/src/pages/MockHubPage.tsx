import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Users } from 'lucide-react'
import { PageHeader, SdvgCard } from '@/components/brand/SdvgCard'
import { CompanyMockModal } from '@/components/mock/CompanyMockModal'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { PageContent } from '@/components/PageContent'
import { getBillingMe } from '@/lib/api/billing'
import { listCompanies } from '@/lib/api/content'
import {
  cancelSession,
  getActiveSession,
  startSession,
  startTrainingSession,
} from '@/lib/api/interview'
import { formatApiError, readAccessToken } from '@/lib/apiClient'
import { formatLimitUsage } from '@/lib/billingLabels'
import { formatInterviewError, isActiveSessionConflict, sessionModeLabel } from '@/lib/interviewLabels'
import { LIVE_LANGS } from '@/lib/live/constants'
import { readGuestDisplayName, persistGuestDisplayName } from '@/lib/live/guestDisplayName'
import { useCreateLiveRoom } from '@/lib/live/useCreateLiveRoom'
import type { Progress, Session, SessionMode } from '@/lib/types'
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
  const qc = useQueryClient()
  const toast = useToast()
  const authed = !!readAccessToken()
  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [liveLanguage, setLiveLanguage] = useState('go')
  const [guestName, setGuestName] = useState(() => readGuestDisplayName())

  const companiesQ = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies() })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })
  const activeQ = useQuery({
    queryKey: ['active-session'],
    queryFn: getActiveSession,
    enabled: authed,
    refetchInterval: 60_000,
  })

  function notifyError(err: unknown) {
    const raw = formatApiError(err)
    toast.push(formatInterviewError(err), 'error')
    if (isActiveSessionConflict(raw)) {
      void activeQ.refetch()
    }
  }

  const startMockM = useMutation({
    mutationFn: (templateId: string) => startSession(templateId),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['active-session'] })
      setCompanyModalOpen(false)
      navigate(`/interview/session/${data.session.id}`)
    },
    onError: notifyError,
  })

  const startSoloM = useMutation({
    mutationFn: (mode: SessionMode) => startTrainingSession(mode),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['active-session'] })
      navigate(`/interview/session/${data.session.id}`)
    },
    onError: notifyError,
  })

  const createLiveM = useCreateLiveRoom()

  const cancelActiveM = useMutation({
    mutationFn: (sessionId: string) => cancelSession(sessionId),
    onSuccess: () => {
      void activeQ.refetch()
      toast.push('Сессия завершена', 'success')
    },
    onError: (err) => toast.push(formatInterviewError(formatApiError(err)), 'error'),
  })

  const companyTemplatesEnabled = billingQ.data?.features.company_templates_enabled !== false
  const mockQuota = billingQ.data?.limits.mock_interviews_per_month
  const mockQuotaExhausted =
    mockQuota != null &&
    !mockQuota.unlimited &&
    mockQuota.limit != null &&
    mockQuota.used >= mockQuota.limit

  const companies = companiesQ.data?.companies ?? []
  const activeSession = activeQ.data?.session ?? null
  const activeProgress = activeQ.data?.progress ?? null

  const canStartCompanyMock =
    companyTemplatesEnabled && !mockQuotaExhausted && !startMockM.isPending

  function handleCreateLive() {
    if (!authed) persistGuestDisplayName(guestName || 'Guest')
    createLiveM.mutate(
      { language: liveLanguage, displayName: guestName || undefined },
      { onError: (err) => toast.push(formatApiError(err), 'error') },
    )
  }

  return (
    <PageContent className="gap-8">
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

      {activeSession ? (
        <ActiveSessionCard
          session={activeSession}
          progress={activeProgress}
          loading={cancelActiveM.isPending}
          onContinue={() => navigate(`/interview/session/${activeSession.id}`)}
          onCancel={() => cancelActiveM.mutate(activeSession.id)}
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
            <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-2" />
          ) : companies.length === 0 ? (
            <p className="text-[13px] text-text-muted">Каталог компаний пока пуст.</p>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              icon={<Building2 className="h-4 w-4" />}
              iconRight={<ArrowRight className="h-4 w-4" />}
              disabled={!canStartCompanyMock || mockQuotaExhausted}
              onClick={() => setCompanyModalOpen(true)}
            >
              Выбрать шаблон
            </Button>
          )}
        </PracticeCard>
      </div>

      <CompanyMockModal
        open={companyModalOpen}
        onClose={() => setCompanyModalOpen(false)}
        companies={companies}
        starting={startMockM.isPending}
        disabled={!canStartCompanyMock || mockQuotaExhausted}
        onStart={(templateId) => startMockM.mutate(templateId)}
      />
    </PageContent>
  )
}

function ActiveSessionCard({
  session,
  progress,
  loading,
  onContinue,
  onCancel,
}: {
  session: Session
  progress: Progress | null
  loading: boolean
  onContinue: () => void
  onCancel: () => void
}) {
  const progressText = progress
    ? `${progress.evaluated_tasks + progress.skipped_tasks}/${progress.total_tasks} задач`
    : null

  return (
    <SdvgCard eyebrow="Active session" title="Продолжить текущую сессию">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">{sessionModeLabel(session.mode)}</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {progressText ? `${progressText} · ` : null}
            начата{' '}
            {session.started_at
              ? new Date(session.started_at).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'недавно'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={onContinue}>
            Продолжить
          </Button>
          <Button variant="ghost" size="sm" loading={loading} onClick={onCancel}>
            Завершить
          </Button>
        </div>
      </div>
    </SdvgCard>
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
