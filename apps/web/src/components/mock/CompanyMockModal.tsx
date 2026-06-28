import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { listInterviewTemplates } from '@/lib/api/content'
import type { Company, InterviewTemplate } from '@/lib/types'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

type Props = {
  open: boolean
  onClose: () => void
  companies: Company[]
  starting: boolean
  disabled: boolean
  onStart: (templateId: string) => void
}

export function CompanyMockModal({
  open,
  onClose,
  companies,
  starting,
  disabled,
  onStart,
}: Props) {
  const { t } = useI18n()
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCompanyId((prev) => prev ?? companies[0]?.id ?? null)
  }, [open, companies])

  const templatesQ = useQuery({
    queryKey: ['templates', companyId, 'modal'],
    queryFn: () => listInterviewTemplates(companyId ?? undefined),
    enabled: open && !!companyId,
  })

  const selectedCompany = companies.find((c) => c.id === companyId)
  const templates = templatesQ.data?.templates ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('mock.modal.title')}
      description={t('mock.modal.description')}
      className="max-w-3xl"
    >
      <div className="flex min-h-[320px] flex-col sm:flex-row">
        <aside className="shrink-0 border-b border-border p-3 sm:w-[200px] sm:border-b-0 sm:border-r sm:p-4">
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('mock.modal.companies')}
          </p>
          <ul className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
            {companies.map((c) => (
              <li key={c.id} className="shrink-0 sm:shrink">
                <button
                  type="button"
                  onClick={() => setCompanyId(c.id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors sm:whitespace-normal',
                    companyId === c.id
                      ? 'bg-surface-2 font-medium text-text-primary'
                      : 'text-text-secondary hover:bg-surface-2/60 hover:text-text-primary',
                  )}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          {!companyId ? (
            <p className="text-sm text-text-muted">{t('mock.modal.noCompanies')}</p>
          ) : templatesQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('mock.modal.loadingTemplates')}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-text-muted">
              {t('mock.modal.noTemplates', { company: selectedCompany?.name ?? '—' })}
            </p>
          ) : (
            <>
              <p className="mb-3 text-[13px] text-text-secondary">
                {t('mock.modal.templatesFor', { company: selectedCompany?.name ?? '' })}
              </p>
              <ul className="flex flex-col gap-2">
                {templates.map((tpl) => (
                  <TemplateRow
                    key={tpl.id}
                    template={tpl}
                    disabled={disabled || starting}
                    onPick={() => onStart(tpl.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function TemplateRow({
  template,
  disabled,
  onPick,
}: {
  template: InterviewTemplate
  disabled: boolean
  onPick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2 disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-text-primary">{template.title}</span>
          {template.description ? (
            <span className="mt-0.5 block line-clamp-2 text-[13px] text-text-secondary">
              {template.description}
            </span>
          ) : null}
          {template.target_level ? (
            <span className="mt-1.5 inline-block font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
              {template.target_level}
            </span>
          ) : null}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
      </button>
    </li>
  )
}
