import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { listRetryItems, startRetrySession, startTrainingSession } from '@/lib/api/interview'
import { resolveArticlePractice } from '@/lib/learn/practice'
import { useI18n } from '@/lib/i18n'
import type { Article, ArticleTaskLink } from '@/lib/types'

function LinkedTaskRow({
  task,
  retryItemId,
}: {
  task: ArticleTaskLink
  retryItemId?: string
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const suggestion = resolveArticlePractice([`${task.type}.overall`])

  const retryM = useMutation({
    mutationFn: () => startRetrySession([retryItemId!]),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  const soloM = useMutation({
    mutationFn: () => startTrainingSession(suggestion!.mode),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{task.title}</div>
        <div className="font-mono text-[11px] text-text-muted">
          {task.difficulty} · {task.slug}
        </div>
      </div>
      {retryItemId ? (
        <Button
          size="sm"
          variant="primary"
          loading={retryM.isPending}
          iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          onClick={() => retryM.mutate()}
        >
          {t('learn.linkedTaskRetry')}
        </Button>
      ) : suggestion ? (
        <Button
          size="sm"
          variant="ghost"
          loading={soloM.isPending}
          onClick={() => soloM.mutate()}
        >
          {t('learn.linkedTaskPractice')}
        </Button>
      ) : null}
    </li>
  )
}

export function ArticleLinkedTasks({ article }: { article: Article }) {
  const { t } = useI18n()
  const tasks = article.linked_tasks ?? []
  if (tasks.length === 0) return null

  const retryQ = useQuery({
    queryKey: ['retry-items'],
    queryFn: listRetryItems,
  })

  const retryByTask = new Map(
    (retryQ.data?.items ?? []).map((item) => [item.task_id, item.id] as const),
  )

  return (
    <div className="mt-6 border-t border-border pt-6">
      <h3 className="text-[14px] font-semibold">{t('learn.linkedTasksTitle')}</h3>
      <p className="mt-1 text-[13px] text-text-secondary">{t('learn.linkedTasksHint')}</p>
      <ul className="mt-3 space-y-2">
        {[...tasks]
          .sort((a, b) => a.position - b.position)
          .map((task) => (
            <LinkedTaskRow key={task.task_id} task={task} retryItemId={retryByTask.get(task.task_id)} />
          ))}
      </ul>
    </div>
  )
}
