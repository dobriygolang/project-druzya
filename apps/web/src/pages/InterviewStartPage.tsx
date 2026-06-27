import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  getInterviewTemplateDetail,
  listCompanies,
  listInterviewTemplates,
} from '@/lib/api/content'
import { startSession } from '@/lib/api/interview'

export default function InterviewStartPage() {
  const navigate = useNavigate()
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

  const startM = useMutation({
    mutationFn: (id: string) => startSession(id),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  if (companiesQ.isLoading) return <p className="text-sm text-text-muted">Загрузка компаний…</p>
  if (companiesQ.isError) {
    return (
      <ErrorMessage
        message={companiesQ.error instanceof Error ? companiesQ.error.message : 'Ошибка'}
        onRetry={() => void companiesQ.refetch()}
      />
    )
  }

  const companies = companiesQ.data?.companies
  if (!companies) return <p className="text-sm text-text-muted">Нет данных.</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Mock-интервью</h1>
        <p className="mt-1 text-sm text-text-muted">
          Выбери компанию и шаблон интервью. Сессия включает алгоритмы и behavioral-секции.
        </p>
      </div>

      {startM.isError ? (
        <ErrorMessage
          message={startM.error instanceof Error ? startM.error.message : 'Не удалось начать сессию'}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="font-medium">Компания</h2>
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
                  'w-full text-left transition-colors',
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
      </section>

      {companyId ? (
        <section className="space-y-3">
          <h2 className="font-medium">Шаблон</h2>
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
                    'w-full text-left transition-colors',
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
        </section>
      ) : null}

      {detailQ.data ? (
        <Card elevation="e2">
          <h2 className="font-medium">Секции</h2>
          <ol className="mt-3 space-y-2">
            {detailQ.data.sections
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span>
                    {s.position}. {s.title}{' '}
                    <span className="text-text-muted">({s.section_type})</span>
                  </span>
                  <span className="text-text-muted">{s.tasks_count} tasks</span>
                </li>
              ))}
          </ol>
        </Card>
      ) : null}

      <Button loading={startM.isPending} disabled={!templateId} onClick={() => templateId && startM.mutate(templateId)}>
        Начать интервью
      </Button>
    </div>
  )
}
