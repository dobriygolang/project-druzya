import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { SectionCard } from '@/components/SectionCard'
import { getBillingMe } from '@/lib/api/billing'
import {
  getInterviewTemplateDetail,
  listCompanies,
  listInterviewTemplates,
} from '@/lib/api/content'
import { startSession } from '@/lib/api/interview'
import { formatApiError } from '@/lib/apiClient'
import { formatLimitUsage } from '@/lib/billingLabels'
import { useDomainLabels } from '@/lib/labels'

export default function InterviewStartPage() {
  const navigate = useNavigate()
  const labels = useDomainLabels()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)

  const companiesQ = useQuery({ queryKey: ['companies'], queryFn: () => listCompanies() })
  const templatesQ = useQuery({
    queryKey: ['templates', companyId],
    queryFn: () => listInterviewTemplates(companyId ?? undefined),
    enabled: !!companyId,
  })
  const detailQ = useQuery({
    queryKey: ['template-detail', templateId],
    queryFn: () => getInterviewTemplateDetail(templateId!),
    enabled: !!templateId,
  })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })

  const companyTemplatesEnabled = billingQ.data?.features.company_templates_enabled !== false
  const mockQuota = billingQ.data?.limits.mock_interviews_per_month
  const mockQuotaExhausted =
    mockQuota != null &&
    !mockQuota.unlimited &&
    mockQuota.limit != null &&
    mockQuota.used >= mockQuota.limit

  const startM = useMutation({
    mutationFn: (id: string) => startSession(id),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  if (companiesQ.isLoading) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Загрузка компаний…</p>
      </PageContent>
    )
  }
  if (companiesQ.isError) {
    return (
      <PageContent>
        <ErrorMessage
          message={companiesQ.error instanceof Error ? companiesQ.error.message : 'Ошибка'}
          onRetry={() => void companiesQ.refetch()}
        />
      </PageContent>
    )
  }

  const companies = companiesQ.data?.companies
  if (!companies) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Нет данных.</p>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <header className="flex flex-col gap-2">
        <Link to="/practice" className="text-[13px] text-text-muted underline">
          ← Все режимы
        </Link>
        <h1 className="font-display text-3xl font-bold leading-tight">Mock-интервью</h1>
        <p className="text-[14px] text-text-secondary">
          Выбери компанию и шаблон интервью. Сессия включает алгоритмы и behavioral-секции.
        </p>
      </header>

      {startM.isError ? (
        <ErrorMessage message={formatStartError(startM.error)} />
      ) : null}

      {!companyTemplatesEnabled && billingQ.isSuccess ? (
        <Card elevation="e1" className="border-border-strong">
          <p className="text-sm text-text-secondary">
            Шаблоны компаний доступны на Pro.{' '}
            <Link to="/profile" className="underline">
              Посмотреть тариф
            </Link>
          </p>
        </Card>
      ) : null}

      {mockQuotaExhausted && billingQ.isSuccess && mockQuota ? (
        <Card elevation="e1" className="border-border-strong">
          <p className="text-sm text-text-secondary">
            {formatLimitUsage('mock_interviews_per_month', mockQuota)} — лимит исчерпан.
          </p>
        </Card>
      ) : null}

      <SectionCard title="Компания">
        {companies.length === 0 ? (
          <p className="text-sm text-text-muted">Каталог пуст. Запусти seed в content-service.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {companies.map((c) => (
              <Card
                key={c.id}
                as="button"
                type="button"
                elevation={companyId === c.id ? 'e2' : 'e1'}
                className={clsx(
                  'w-full text-left transition-colors card-lift',
                  companyId === c.id ? 'ring-1 ring-text-primary/20' : 'hover:bg-surface-2',
                )}
                onClick={() => {
                  setCompanyId(c.id)
                  setTemplateId(null)
                }}
              >
                <h3 className="font-medium">{c.name}</h3>
                {c.description ? <p className="mt-1 text-sm text-text-muted">{c.description}</p> : null}
              </Card>
            ))}
          </div>
        )}
      </SectionCard>

      {companyId ? (
        <SectionCard title="Шаблон">
          {templatesQ.isLoading ? (
            <p className="text-sm text-text-muted">Загрузка шаблонов…</p>
          ) : templatesQ.isError ? (
            <ErrorMessage
              message={
                templatesQ.error instanceof Error ? templatesQ.error.message : 'Ошибка шаблонов'
              }
              onRetry={() => void templatesQ.refetch()}
            />
          ) : !templatesQ.data?.templates.length ? (
            <p className="text-sm text-text-muted">Нет шаблонов для этой компании.</p>
          ) : (
            <div className="space-y-3">
              {templatesQ.data.templates.map((t) => (
                <Card
                  key={t.id}
                  as="button"
                  type="button"
                  elevation={templateId === t.id ? 'e2' : 'e1'}
                  className={clsx(
                    'w-full text-left transition-colors card-lift',
                    templateId === t.id ? 'ring-1 ring-text-primary/20' : 'hover:bg-surface-2',
                  )}
                  onClick={() => setTemplateId(t.id)}
                >
                  <h3 className="font-medium">{t.title}</h3>
                  {t.description ? (
                    <p className="mt-1 text-sm text-text-muted">{t.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-text-muted">
                    Passing score: {t.passing_score}
                    {t.target_level ? ` · ${t.target_level}` : ''}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {detailQ.data ? (
        <SectionCard title="Секции">
          <ol className="space-y-2">
            {detailQ.data.sections
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span>
                    {s.position}. {s.title}{' '}
                    <span className="text-text-muted">({labels.sectionType(s.section_type)})</span>
                  </span>
                  <span className="text-text-muted">{s.tasks_count} tasks</span>
                </li>
              ))}
          </ol>
        </SectionCard>
      ) : null}

      <Button
        loading={startM.isPending}
        disabled={!templateId || !companyTemplatesEnabled || mockQuotaExhausted}
        onClick={() => templateId && startM.mutate(templateId)}
      >
        Начать интервью
      </Button>
    </PageContent>
  )
}

function formatStartError(err: unknown): string {
  const msg = formatApiError(err)
  if (msg.includes('feature not available on current plan')) {
    return 'Шаблоны компаний недоступны на текущем тарифе. Подключи Pro или дождись обновления лимитов.'
  }
  if (msg.includes('quota exceeded')) {
    return 'Лимит mock-интервью на этот месяц исчерпан.'
  }
  return msg || 'Не удалось начать сессию'
}
