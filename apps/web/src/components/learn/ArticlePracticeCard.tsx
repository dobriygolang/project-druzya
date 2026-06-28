import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { startTrainingSession } from '@/lib/api/interview'
import { formatApiError } from '@/lib/apiClient'
import { resolveArticlePractice } from '@/lib/learn/practice'
import { useI18n } from '@/lib/i18n'
import type { Article } from '@/lib/types'

export function ArticlePracticeCard({ article }: { article: Article }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const suggestion = resolveArticlePractice(article.skill_keys)

  const startM = useMutation({
    mutationFn: () => startTrainingSession(suggestion!.mode),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  if (!suggestion) return null

  const label =
    suggestion.labelKey === 'generic'
      ? t('learn.practiceGeneric')
      : t(`learn.practice.${suggestion.labelKey}` as 'learn.practice.algo')

  return (
    <div className="mt-8 rounded-xl border border-border bg-surface-2 p-4">
      <h3 className="text-[14px] font-semibold">{t('learn.practiceTitle')}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{t('learn.practiceHint')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={startM.isPending}
          iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          onClick={() => startM.mutate()}
        >
          {label}
        </Button>
        <Link to={suggestion.mockPath} className="no-underline">
          <Button variant="ghost" size="sm">
            {t('learn.practiceBrowseMock')}
          </Button>
        </Link>
      </div>
      {startM.isError ? (
        <p className="mt-2 text-[12px] text-red-400">{formatApiError(startM.error)}</p>
      ) : null}
    </div>
  )
}
