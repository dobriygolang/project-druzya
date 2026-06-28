import { useMemo, useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { listMyActiveRooms } from '@/lib/api/rooms'
import { formatApiError, readAccessToken } from '@/lib/apiClient'
import { useBillingLabels } from '@/lib/billingLabels'
import { isActiveSessionConflict, useInterviewLabels } from '@/lib/interviewLabels'
import { useI18n } from '@/lib/i18n'
import { LIVE_LANGS } from '@/lib/live/constants'
import { readGuestDisplayName, persistGuestDisplayName } from '@/lib/live/guestDisplayName'
import { useCreateLiveRoom } from '@/lib/live/useCreateLiveRoom'
import type { Progress, Session, SessionMode } from '@/lib/types'
import { cn } from '@/lib/cn'

export default function MockHubPage() {
  const { t, locale, formatDate } = useI18n()
  const [searchParams] = useSearchParams()
  const soloFocus = searchParams.get('solo')
  const soloCardRef = useRef<HTMLDivElement>(null)
  const { formatLimitUsage } = useBillingLabels()
  const { sessionModeLabel, formatInterviewError } = useInterviewLabels()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const authed = !!readAccessToken()
  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [liveLanguage, setLiveLanguage] = useState('go')
  const [guestName, setGuestName] = useState(() => readGuestDisplayName())

  const soloSections = useMemo(
    () =>
      [
        {
          id: 'algo',
          label: t('mock.solo.algo'),
          hint: t('mock.solo.algoHint'),
          mode: 'SESSION_MODE_ALGORITHMS_TRAINING' as SessionMode,
        },
        {
          id: 'coding',
          label: t('mock.solo.coding'),
          hint: t('mock.solo.codingHint'),
          mode: 'SESSION_MODE_LIVE_CODING_TRAINING' as SessionMode,
        },
        {
          id: 'sysdesign',
          label: t('mock.solo.sysdesign'),
          hint: t('mock.solo.sysdesignHint'),
          mode: 'SESSION_MODE_SYSTEM_DESIGN_TRAINING' as SessionMode,
        },
        {
          id: 'behavioral',
          label: t('mock.solo.behavioral'),
          hint: t('mock.solo.behavioralHint'),
          mode: 'SESSION_MODE_BEHAVIORAL_TRAINING' as SessionMode,
        },
      ] as const,
    [t],
  )

  const companiesQ = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies() })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })
  const activeQ = useQuery({
    queryKey: ['active-session'],
    queryFn: getActiveSession,
    enabled: authed,
    refetchInterval: 60_000,
  })
  const activeRoomsQ = useQuery({
    queryKey: ['my-active-rooms'],
    queryFn: listMyActiveRooms,
    enabled: authed,
    refetchInterval: 30_000,
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
      toast.push(t('interview.sessionCancelled'), 'success')
    },
    onError: (err) => toast.push(formatInterviewError(err), 'error'),
  })

  const companyTemplatesEnabled = billingQ.data?.features.company_templates_enabled !== false
  const mockQuota = billingQ.data?.limits.mock_interviews_per_month
  const liveRoomsQuota = billingQ.data?.limits.live_rooms_per_month
  const activeRooms = activeRoomsQ.data
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
    if (!authed) persistGuestDisplayName(guestName || t('common.guest'))
    createLiveM.mutate(
      { language: liveLanguage, displayName: guestName || undefined },
      { onError: (err) => toast.push(formatApiError(err), 'error') },
    )
  }

  const timeLocale = locale === 'en' ? 'en-US' : 'ru-RU'

  useEffect(() => {
    if (!soloFocus || !soloCardRef.current) return
    soloCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [soloFocus])

  return (
    <PageContent className="gap-8">
      <PageHeader
        eyebrow={t('mock.eyebrow')}
        title={t('mock.title')}
        description={t('mock.description')}
      />

      {mockQuotaExhausted && billingQ.isSuccess && mockQuota ? (
        <QuotaBanner>
          {formatLimitUsage('mock_interviews_per_month', mockQuota)}
          {t('billing.quotaExhausted')}
        </QuotaBanner>
      ) : null}

      {activeSession ? (
        <ActiveSessionCard
          session={activeSession}
          progress={activeProgress}
          loading={cancelActiveM.isPending}
          modeLabel={sessionModeLabel(activeSession.mode)}
          onContinue={() => navigate(`/interview/session/${activeSession.id}`)}
          onCancel={() => cancelActiveM.mutate(activeSession.id)}
          t={t}
          formatDate={formatDate}
        />
      ) : null}

      {authed && activeRoomsQ.isSuccess && activeRooms ? (
        <ActiveRoomsCard
          rooms={activeRooms.rooms}
          activeCount={activeRooms.active_count}
          concurrentLimit={activeRooms.concurrent_limit}
          concurrentUnlimited={activeRooms.concurrent_unlimited}
          monthlyQuota={liveRoomsQuota}
          formatLimitUsage={formatLimitUsage}
          t={t}
          timeLocale={timeLocale}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div ref={soloCardRef} className={soloFocus ? 'rounded-2xl ring-2 ring-brand-green/40' : undefined}>
        <PracticeCard
          eyebrow={t('mock.solo.eyebrow')}
          title={t('mock.solo.title')}
          description={t('mock.solo.description')}
        >
          <div className="flex flex-wrap gap-2">
            {soloSections.map((s) => (
              <PillButton
                key={s.id}
                title={s.hint}
                active={soloFocus === s.id}
                loading={startSoloM.isPending && startSoloM.variables === s.mode}
                disabled={mockQuotaExhausted || startSoloM.isPending}
                onClick={() => startSoloM.mutate(s.mode)}
              >
                {s.label}
              </PillButton>
            ))}
          </div>
        </PracticeCard>
        </div>

        <PracticeCard
          eyebrow={t('mock.live.eyebrow')}
          title={t('mock.live.title')}
          description={t('mock.live.description')}
        >
          <div className="flex flex-col gap-4">
            {!authed ? (
              <label className="block">
                <span className="text-[13px] text-text-secondary">{t('mock.live.displayName')}</span>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t('common.guest')}
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
                />
              </label>
            ) : null}

            <div>
              <span className="text-[13px] text-text-secondary">{t('mock.live.language')}</span>
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
              {t('mock.live.createRoom')}
            </Button>
          </div>
        </PracticeCard>

        <PracticeCard
          eyebrow={t('mock.company.eyebrow')}
          title={t('mock.company.title')}
          description={t('mock.company.description')}
        >
          {!companyTemplatesEnabled && billingQ.isSuccess ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {t('mock.company.proOnly')}{' '}
              <Link to="/pricing" className="text-text-primary underline">
                {t('common.pricing')}
              </Link>
            </p>
          ) : companiesQ.isLoading ? (
            <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-2" />
          ) : companies.length === 0 ? (
            <p className="text-[13px] text-text-muted">{t('mock.company.emptyCatalog')}</p>
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
              {t('mock.company.pickTemplate')}
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

function ActiveRoomsCard({
  rooms,
  activeCount,
  concurrentLimit,
  concurrentUnlimited,
  monthlyQuota,
  formatLimitUsage,
  t,
  timeLocale,
}: {
  rooms: import('@/lib/api/rooms').ActiveRoomSummary[]
  activeCount: number
  concurrentLimit?: number
  concurrentUnlimited?: boolean
  monthlyQuota?: import('@/lib/billingLabels').UsageLimit
  formatLimitUsage: (key: string, lim: import('@/lib/billingLabels').UsageLimit) => string
  t: (key: string, vars?: Record<string, string | number>) => string
  timeLocale: string
}) {
  const concurrentText = concurrentUnlimited
    ? t('mock.activeRooms.concurrentUnlimited', { count: activeCount })
    : concurrentLimit != null
      ? t('mock.activeRooms.concurrentLimited', { active: activeCount, limit: concurrentLimit })
      : t('mock.activeRooms.concurrentSimple', { count: activeCount })

  return (
    <SdvgCard eyebrow={t('mock.activeRooms.eyebrow')} title={t('mock.activeRooms.title')}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-text-secondary">{concurrentText}</p>
        {monthlyQuota ? (
          <p className="text-[13px] text-text-muted">
            {t('common.created')} {formatLimitUsage('live_rooms_per_month', monthlyQuota)}
          </p>
        ) : null}
        {rooms.length === 0 ? (
          <p className="text-[13px] text-text-muted">{t('mock.activeRooms.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  to={`/live/${room.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm no-underline transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  <span className="font-medium text-text-primary">
                    {room.language.toUpperCase()} · {room.room_type}
                  </span>
                  <span className="text-[12px] text-text-muted">
                    {room.created_at
                      ? new Date(room.created_at).toLocaleTimeString(timeLocale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : t('common.open')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SdvgCard>
  )
}

function ActiveSessionCard({
  session,
  progress,
  loading,
  modeLabel,
  onContinue,
  onCancel,
  t,
  formatDate,
}: {
  session: Session
  progress: Progress | null
  loading: boolean
  modeLabel: string
  onContinue: () => void
  onCancel: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string
}) {
  const progressText = progress
    ? `${progress.evaluated_tasks + progress.skipped_tasks}/${progress.total_tasks} ${t('common.tasks')}`
    : null

  const startedAt = session.started_at
    ? formatDate(new Date(session.started_at), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : t('common.recently')

  return (
    <SdvgCard eyebrow={t('mock.activeSession.eyebrow')} title={t('mock.activeSession.title')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">{modeLabel}</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {progressText ? `${progressText} · ` : null}
            {t('common.started')} {startedAt}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={onContinue}>
            {t('mock.activeSession.continue')}
          </Button>
          <Button variant="ghost" size="sm" loading={loading} onClick={onCancel}>
            {t('mock.activeSession.finish')}
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
