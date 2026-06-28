import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PillButton } from '@/components/mock/PillButton'
import type { PracticeScope, SessionMode, TaskTypeCoverage } from '@/lib/types'
import { useI18n } from '@/lib/i18n'

export type SoloStartParams = {
  mode: SessionMode
  practiceScope: PracticeScope
  companyId?: string
}

type SoloSection = {
  id: string
  label: string
  hint: string
  mode: SessionMode
  taskType: string
}

type Props = {
  open: boolean
  onClose: () => void
  companies: { id: string; name: string }[]
  companiesLoading: boolean
  starting: boolean
  disabled: boolean
  initialSectionId?: string | null
  initialScope?: 'random' | 'company' | 'review' | null
  taskTypeCoverage?: TaskTypeCoverage[]
  onStart: (params: SoloStartParams) => void
}

function coverageForTaskType(coverage: TaskTypeCoverage[] | undefined, taskType: string) {
  return coverage?.find((c) => c.task_type === taskType)
}

export function SoloPracticeModal({
  open,
  onClose,
  companies,
  companiesLoading,
  starting,
  disabled,
  initialSectionId,
  initialScope,
  taskTypeCoverage,
  onStart,
}: Props) {
  const { t } = useI18n()
  const sections = useMemo(
    () =>
      [
        {
          id: 'algo',
          label: t('mock.solo.algo'),
          hint: t('mock.solo.algoHint'),
          mode: 'SESSION_MODE_ALGORITHMS_TRAINING' as SessionMode,
          taskType: 'algorithm',
        },
        {
          id: 'coding',
          label: t('mock.solo.coding'),
          hint: t('mock.solo.codingHint'),
          mode: 'SESSION_MODE_LIVE_CODING_TRAINING' as SessionMode,
          taskType: 'live_coding',
        },
        {
          id: 'sysdesign',
          label: t('mock.solo.sysdesign'),
          hint: t('mock.solo.sysdesignHint'),
          mode: 'SESSION_MODE_SYSTEM_DESIGN_TRAINING' as SessionMode,
          taskType: 'system_design',
        },
        {
          id: 'behavioral',
          label: t('mock.solo.behavioral'),
          hint: t('mock.solo.behavioralHint'),
          mode: 'SESSION_MODE_BEHAVIORAL_TRAINING' as SessionMode,
          taskType: 'behavioral',
        },
      ] satisfies SoloSection[],
    [t],
  )

  const [mode, setMode] = useState<SessionMode>('SESSION_MODE_ALGORITHMS_TRAINING')
  const [scope, setScope] = useState<'random' | 'company' | 'review'>('random')
  const [companyId, setCompanyId] = useState('')

  useEffect(() => {
    if (!open) return
    const section = initialSectionId
      ? sections.find((s) => s.id === initialSectionId)
      : sections[0]
    setMode(section?.mode ?? 'SESSION_MODE_ALGORITHMS_TRAINING')
    setScope(initialScope ?? 'random')
    setCompanyId(companies[0]?.id ?? '')
  }, [open, initialSectionId, initialScope, sections, companies])

  const activeSection = sections.find((s) => s.mode === mode)
  const coverage = activeSection
    ? coverageForTaskType(taskTypeCoverage, activeSection.taskType)
    : undefined

  const startDisabled =
    disabled ||
    starting ||
    (scope === 'company' && (!companyId || companies.length === 0))

  function handleStart() {
    const practiceScope: PracticeScope =
      scope === 'company'
        ? 'PRACTICE_SCOPE_COMPANY_TRACK'
        : scope === 'review'
          ? 'PRACTICE_SCOPE_REVIEW'
          : 'PRACTICE_SCOPE_RANDOM_ONE'
    onStart({
      mode,
      practiceScope,
      companyId: scope === 'company' ? companyId : undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('mock.solo.title')}
      description={t('mock.solo.description')}
      className="max-w-lg"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('mock.solo.sectionLabel')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sections.map((s) => (
              <PillButton
                key={s.id}
                title={s.hint}
                active={mode === s.mode}
                onClick={() => setMode(s.mode)}
              >
                {s.label}
              </PillButton>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('mock.solo.scopeLabel')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <PillButton active={scope === 'random'} onClick={() => setScope('random')}>
              {t('mock.solo.scopeRandom')}
            </PillButton>
            <PillButton
              active={scope === 'review'}
              onClick={() => setScope('review')}
              title={t('mock.solo.scopeReviewHint')}
            >
              {t('mock.solo.scopeReview')}
            </PillButton>
            <PillButton
              active={scope === 'company'}
              onClick={() => setScope('company')}
              disabled={companies.length === 0}
            >
              {t('mock.solo.scopeCompany')}
            </PillButton>
          </div>
        </div>

        {scope === 'company' ? (
          companiesLoading ? (
            <div className="h-9 w-full animate-pulse rounded-lg bg-surface-2" />
          ) : (
            <label className="block">
              <span className="text-[13px] text-text-secondary">{t('mock.solo.companyLabel')}</span>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : scope === 'review' ? (
          <p className="text-[13px] text-text-muted">{t('mock.solo.reviewHint')}</p>
        ) : (
          <p className="text-[13px] text-text-muted">
            {coverage && coverage.passed_count > 0
              ? t('mock.solo.randomHintWithCoverage', { passed: coverage.passed_count })
              : t('mock.solo.randomHint')}
          </p>
        )}

        <Button
          variant="primary"
          className="w-full sm:w-auto"
          iconRight={<ArrowRight className="h-4 w-4" />}
          loading={starting}
          disabled={startDisabled}
          onClick={handleStart}
        >
          {t('mock.solo.start')}
        </Button>
      </div>
    </Modal>
  )
}
