import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { SectionCard } from '@/components/SectionCard'
import { startTrainingSession } from '@/lib/api/interview'
import { formatApiError } from '@/lib/apiClient'
import { PRACTICE_MODES, type PracticeMode } from '@/lib/practiceModes'

export default function PracticePage() {
  const navigate = useNavigate()

  const startM = useMutation({
    mutationFn: (mode: PracticeMode) => {
      if (mode.kind !== 'session') throw new Error('invalid mode')
      return startTrainingSession(mode.mode)
    },
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  return (
    <PageContent>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold leading-tight">Тренировка</h1>
        <p className="text-[14px] text-text-secondary">
          Выбери режим: совместная live-комната, полный mock или отдельную секцию — алгоритмы,
          system design, behavioral и др.
        </p>
      </header>

      {startM.isError ? <ErrorMessage message={formatStartError(startM.error)} /> : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {PRACTICE_MODES.map((mode) => (
          <PracticeModeCard
            key={mode.id}
            mode={mode}
            loading={startM.isPending && startM.variables?.id === mode.id}
            onStart={() => startM.mutate(mode)}
          />
        ))}
      </div>

      <SectionCard title="Как попасть в live-комнату">
        <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-text-secondary">
          <li>
            Нажми <b>Live-комната</b> → «Создать комнату» (или открой{' '}
            <Link to="/live/new" className="underline">
              /live/new
            </Link>
            ).
          </li>
          <li>В комнате нажми <b>Пригласить</b> — ссылка скопируется в буфер.</li>
          <li>Отправь ссылку напарнику. Он откроет её и войдёт как гость или по аккаунту.</li>
          <li>
            Из mock-сессии на algorithm-задаче тоже можно открыть live-комнату с привязкой к
            задаче.
          </li>
        </ol>
      </SectionCard>
    </PageContent>
  )
}

function PracticeModeCard({
  mode,
  loading,
  onStart,
}: {
  mode: PracticeMode
  loading: boolean
  onStart: () => void
}) {
  return (
    <SectionCard icon={<mode.icon className="h-4 w-4" />} title={mode.title}>
      {mode.badge ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          {mode.badge}
        </span>
      ) : null}
      <p className="text-[13px] leading-relaxed text-text-secondary">{mode.description}</p>
      {mode.kind === 'link' ? (
        <Link to={mode.to}>
          <Button
            variant="primary"
            size="sm"
            iconRight={<ArrowRight className="h-4 w-4" />}
            className="self-start"
          >
            {mode.id === 'live-room' ? 'Создать комнату' : 'Выбрать шаблон'}
          </Button>
        </Link>
      ) : (
        <Button variant="secondary" size="sm" loading={loading} onClick={onStart} className="self-start">
          Начать
        </Button>
      )}
    </SectionCard>
  )
}

function formatStartError(err: unknown): string {
  const msg = formatApiError(err)
  if (msg.includes('no tasks available') || msg.includes('not found')) {
    return 'В каталоге пока нет задач для этого режима. Запусти seed в content-service.'
  }
  if (msg.includes('quota exceeded')) {
    return 'Лимит сессий на этот месяц исчерпан.'
  }
  if (msg.includes('active session')) {
    return 'У тебя уже есть активная сессия. Заверши или отмени её перед новой.'
  }
  return msg || 'Не удалось начать тренировку'
}
