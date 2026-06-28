import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bot, Check, Target, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CompanyCard } from '@/components/mock/CompanyCard'
import { ErrorMessage } from '@/components/ErrorMessage'
import { getBillingMe } from '@/lib/api/billing'
import { listCompanies, listInterviewTemplates } from '@/lib/api/content'
import { startSession, startTrainingSession } from '@/lib/api/interview'
import { formatApiError } from '@/lib/apiClient'
import { formatLimitUsage } from '@/lib/billingLabels'
import type { SessionMode } from '@/lib/types'

const SECTION_IDS = ['hr', 'algo', 'coding', 'sysdesign', 'behavioral'] as const
const SECTION_LABELS: Record<(typeof SECTION_IDS)[number], string> = {
  hr: 'HR',
  algo: 'Algo',
  coding: 'Coding',
  sysdesign: 'System Design',
  behavioral: 'Behavioral',
}

const SECTION_HINTS: Record<(typeof SECTION_IDS)[number], string> = {
  hr: 'Screening & soft skills',
  algo: 'Data structures & algorithms',
  coding: 'Live coding & SQL',
  sysdesign: 'Architecture & scaling',
  behavioral: 'STAR & culture fit',
}

const SECTION_TO_MODE: Record<(typeof SECTION_IDS)[number], SessionMode> = {
  hr: 'SESSION_MODE_BEHAVIORAL_TRAINING',
  algo: 'SESSION_MODE_ALGORITHMS_TRAINING',
  coding: 'SESSION_MODE_LIVE_CODING_TRAINING',
  sysdesign: 'SESSION_MODE_SYSTEM_DESIGN_TRAINING',
  behavioral: 'SESSION_MODE_BEHAVIORAL_TRAINING',
}

const MOCK_SECTIONS_STORAGE_KEY = 'druz9.mock.sections'
const MOCK_AI_ASSIST_STORAGE_KEY = 'druz9.mock.ai_assist'

function loadInitialSections(): string[] {
  try {
    const raw = window.localStorage.getItem(MOCK_SECTIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is string => typeof x === 'string' && (SECTION_IDS as readonly string[]).includes(x),
    )
  } catch {
    return []
  }
}

function loadInitialAiAssist(): boolean {
  try {
    return window.localStorage.getItem(MOCK_AI_ASSIST_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function MockHubPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [aiAssist, setAiAssist] = useState(loadInitialAiAssist)
  const [selectedSections, setSelectedSections] = useState<string[]>(loadInitialSections)
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null)

  const companiesQ = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies() })
  const templatesQ = useQuery({
    queryKey: ['templates', pendingCompanyId],
    queryFn: () => listInterviewTemplates(pendingCompanyId ?? undefined),
    enabled: !!pendingCompanyId,
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

  const focusTitle = searchParams.get('title') ?? ''
  const focusSection = searchParams.get('section') ?? ''

  useEffect(() => {
    if (!focusSection) return
    const mapped = atlasSectionToMockSections(focusSection)
    if (mapped.length === 0) return
    persistSections(mapped)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot preselect from atlas link
  }, [])

  useEffect(() => {
    if (!pendingCompanyId || !templatesQ.data?.templates.length) return
    const template = templatesQ.data.templates[0]
    if (template) {
      startMockM.mutate(template.id)
      setPendingCompanyId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-pick first template after company select
  }, [pendingCompanyId, templatesQ.data])

  const companyTemplatesEnabled = billingQ.data?.features.company_templates_enabled !== false
  const mockQuota = billingQ.data?.limits.mock_interviews_per_month
  const mockQuotaExhausted =
    mockQuota != null &&
    !mockQuota.unlimited &&
    mockQuota.limit != null &&
    mockQuota.used >= mockQuota.limit

  const soloMode = useMemo(() => {
    if (selectedSections.length !== 1) return null
    const id = selectedSections[0] as (typeof SECTION_IDS)[number]
    return SECTION_TO_MODE[id] ?? null
  }, [selectedSections])

  const persistSections = (next: string[]) => {
    setSelectedSections(next)
    try {
      window.localStorage.setItem(MOCK_SECTIONS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* noop */
    }
  }

  const persistAiAssist = (next: boolean) => {
    setAiAssist(next)
    try {
      window.localStorage.setItem(MOCK_AI_ASSIST_STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* noop */
    }
  }

  const toggleSection = (id: string) => {
    if (selectedSections.includes(id)) {
      persistSections(selectedSections.filter((x) => x !== id))
    } else {
      persistSections([...selectedSections, id])
    }
  }

  const handlePickCompany = (companyId: string) => {
    if (!companyTemplatesEnabled || mockQuotaExhausted) return
    setPendingCompanyId(companyId)
  }

  const companies = companiesQ.data?.companies ?? []

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8 lg:px-20 lg:py-8">
      <header className="flex flex-col gap-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">
          Mock Interview
        </div>
        <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">
          Pick a company
        </h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Multi-stage mock under a real company template, or solo practice for a single section.
        </p>
      </header>

      {focusTitle ? (
        <div className="relative flex items-start gap-3 rounded-xl border border-border-strong bg-surface-2 p-4 pl-5">
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-[1.5px] rounded-l-xl"
            style={{ background: 'var(--red)' }}
          />
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-text-primary" />
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
              Atlas focus
            </div>
            <div className="mt-0.5 text-[14px] font-medium text-text-primary">{focusTitle}</div>
          </div>
        </div>
      ) : null}

      <FirstRunSteps />

      <fieldset
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1 p-4"
        aria-label="Interview sections"
      >
        <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          Sections
        </legend>
        <p className="text-xs text-text-secondary">
          Select one section for solo practice, or several for a full mock pipeline.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {SECTION_IDS.map((id) => {
            const checked = selectedSections.includes(id)
            return (
              <button
                key={id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleSection(id)}
                title={SECTION_HINTS[id]}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs tracking-[0.08em] transition-colors duration-[var(--motion-dur-small)] ease-[var(--motion-ease-emphasized)]',
                  checked
                    ? 'border-text-primary bg-text-primary text-bg'
                    : 'border-border bg-surface-2 text-text-secondary hover:border-text-primary/40 hover:text-text-primary',
                ].join(' ')}
              >
                {checked ? <Check className="h-3 w-3" /> : null}
                {SECTION_LABELS[id]}
              </button>
            )
          })}
        </div>
        {soloMode ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 self-start"
            loading={startSoloM.isPending}
            onClick={() => startSoloM.mutate(soloMode)}
          >
            Start solo — {SECTION_LABELS[selectedSections[0] as (typeof SECTION_IDS)[number]]}
          </Button>
        ) : null}
      </fieldset>

      <fieldset
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1 p-4"
        aria-label="AI assistant"
      >
        <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          AI assist
        </legend>
        <AiAssistOption
          checked={!aiAssist}
          onSelect={() => persistAiAssist(false)}
          title="Classic mock"
          body="No AI chat during stages — closer to a real interview."
        />
        <AiAssistOption
          checked={aiAssist}
          onSelect={() => persistAiAssist(true)}
          title="AI-assisted mock"
          body="Chat panel available during stages for hints and clarifications."
          icon={<Bot className="h-4 w-4 text-text-secondary" />}
        />
      </fieldset>

      <div className="rounded-xl border border-border bg-surface-1 p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          Live collab
        </div>
        <p className="text-xs text-text-secondary">
          Pair programming in a shared editor — invite a friend via link.
        </p>
        <Link to="/live/new" className="mt-3 inline-block">
          <Button variant="ghost" size="sm" icon={<Users className="h-4 w-4" />}>
            Open live room
          </Button>
        </Link>
      </div>

      {!companyTemplatesEnabled && billingQ.isSuccess ? (
        <div className="relative pl-3 text-sm text-text-primary">
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-[1.5px]"
            style={{ background: 'var(--red)' }}
          />
          Company templates require Pro.{' '}
          <Link to="/profile" className="underline">
            View plan
          </Link>
        </div>
      ) : null}

      {mockQuotaExhausted && billingQ.isSuccess && mockQuota ? (
        <div className="relative pl-3 text-sm text-text-primary">
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-[1.5px]"
            style={{ background: 'var(--red)' }}
          />
          {formatLimitUsage('mock_interviews_per_month', mockQuota)} — quota exhausted.
        </div>
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

      {companiesQ.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : null}

      {companiesQ.isError ? (
        <ErrorMessage
          message={formatApiError(companiesQ.error)}
          onRetry={() => void companiesQ.refetch()}
        />
      ) : null}

      {companiesQ.isSuccess && companies.length === 0 ? (
        <p className="text-sm text-text-muted">Catalog empty — run content-service seed.</p>
      ) : null}

      {companiesQ.isSuccess && companies.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              id={c.id}
              name={c.name}
              slug={c.slug}
              description={c.description}
              onSelect={handlePickCompany}
              loading={
                (startMockM.isPending && pendingCompanyId === c.id) ||
                (templatesQ.isFetching && pendingCompanyId === c.id)
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AiAssistOption({
  checked,
  onSelect,
  title,
  body,
  icon,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  body: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={[
        'relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-[var(--motion-dur-small)] ease-[var(--motion-ease-emphasized)]',
        checked
          ? 'border-text-primary bg-text-primary/10'
          : 'border-border bg-surface-2 hover:border-border-strong',
      ].join(' ')}
    >
      {checked ? (
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[1.5px] rounded-l-lg"
          style={{ background: 'var(--red)' }}
        />
      ) : null}
      <span
        className={[
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border',
          checked ? 'border-text-primary bg-text-primary text-bg' : 'border-border bg-surface-1',
        ].join(' ')}
        aria-hidden
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-display text-sm font-bold text-text-primary">
          {icon}
          {title}
        </span>
        <span className="text-xs text-text-secondary">{body}</span>
      </div>
    </button>
  )
}

function FirstRunSteps() {
  const steps = [
    { n: '1', title: 'Pick a company', body: 'Choose who you want to simulate.' },
    { n: '2', title: '5 stages back-to-back', body: 'HR, algo, coding, system design, behavioral.' },
    { n: '3', title: 'AI report at the end', body: 'Scores, feedback, and a learning plan.' },
  ]
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          How it works
        </span>
      </div>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

function atlasSectionToMockSections(s: string): string[] {
  switch (s) {
    case 'algorithms':
      return ['algo']
    case 'system_design':
      return ['sysdesign']
    case 'sql':
    case 'databases':
      return ['coding']
    case 'english_hr':
    case 'english':
      return ['hr']
    case 'behavioral':
      return ['behavioral']
    default:
      return []
  }
}
