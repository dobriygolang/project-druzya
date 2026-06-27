import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getCodeRun, isTerminalRunStatus, runCode, type RunType } from '@/lib/api/sandbox'
import type { CodeRun } from '@/lib/types'

interface CodeEditorPanelProps {
  taskId: string
  sessionTaskId: string
  language: string
  onLanguageChange: (lang: string) => void
  code: string
  onCodeChange: (code: string) => void
  onSubmit: () => void
  submitPending: boolean
  submitDisabled?: boolean
}

function RunOutput({ run }: { run: CodeRun }) {
  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex flex-wrap gap-3 text-text-muted">
        <span>status: {run.status}</span>
        {run.tests_total > 0 ? (
          <span>
            tests: {run.tests_passed}/{run.tests_total}
          </span>
        ) : null}
        {run.time_ms != null ? <span>{run.time_ms} ms</span> : null}
        {run.runner ? <span>runner: {run.runner}</span> : null}
      </div>
      {run.compile_output ? (
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-danger">{run.compile_output}</pre>
      ) : null}
      {run.stderr ? (
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-danger">{run.stderr}</pre>
      ) : null}
      {run.stdout ? (
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3">{run.stdout}</pre>
      ) : null}
      {run.error ? (
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-danger">{run.error}</pre>
      ) : null}
      {run.test_results.length > 0 ? (
        <ul className="space-y-2">
          {run.test_results.map((t) => (
            <li key={t.name} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex justify-between gap-2">
                <span>{t.name}</span>
                <span className={t.status === 'passed' ? 'text-text-primary' : 'text-danger'}>
                  {t.status}
                </span>
              </div>
              {t.error ? <p className="mt-1 text-danger">{t.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function CodeEditorPanel({
  taskId,
  sessionTaskId,
  language,
  onLanguageChange,
  code,
  onCodeChange,
  onSubmit,
  submitPending,
  submitDisabled,
}: CodeEditorPanelProps) {
  const [runId, setRunId] = useState<string | null>(null)
  const [lastRunType, setLastRunType] = useState<RunType | null>(null)

  const runQ = useQuery({
    queryKey: ['code-run', runId],
    queryFn: () => getCodeRun(runId!),
    enabled: !!runId,
    refetchInterval: (q) => {
      const status = q.state.data?.run.status
      if (!status || isTerminalRunStatus(status)) return false
      return 1000
    },
  })

  const runM = useMutation({
    mutationFn: (runType: RunType) =>
      runCode({
        taskId,
        sessionTaskId,
        language,
        code,
        runType,
      }),
    onSuccess: (data, runType) => {
      setRunId(data.run.id)
      setLastRunType(runType)
    },
  })

  const activeRun = runQ.data?.run
  const running = runM.isPending || (activeRun != null && !isTerminalRunStatus(activeRun.status))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="lang" className="block text-sm font-medium">
            Язык
          </label>
          <select
            id="lang"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="mt-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          >
            <option value="go">Go</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="code" className="block text-sm font-medium">
          Код
        </label>
        <textarea
          id="code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          rows={16}
          spellCheck={false}
          className="mono mt-1 w-full rounded-xl border border-border bg-bg px-3 py-3 text-sm leading-relaxed"
          placeholder="package main&#10;&#10;func solve() { ... }"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          loading={runM.isPending && lastRunType === 'sample'}
          disabled={running || !code.trim()}
          onClick={() => runM.mutate('sample')}
        >
          Запустить примеры
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={runM.isPending && lastRunType === 'submit'}
          disabled={running || !code.trim()}
          onClick={() => runM.mutate('submit')}
        >
          Полная проверка
        </Button>
        <Button
          loading={submitPending}
          disabled={submitDisabled || !code.trim() || running}
          onClick={onSubmit}
        >
          Отправить на оценку
        </Button>
      </div>

      {runM.isError ? (
        <p className="text-sm text-danger">
          {runM.error instanceof Error ? runM.error.message : 'Ошибка запуска'}
        </p>
      ) : null}

      {activeRun ? (
        <Card elevation="e2" padding="md">
          <p className="mb-3 text-sm font-medium">
            Результат ({activeRun.run_type})
            {running ? ' — выполняется…' : ''}
          </p>
          <RunOutput run={activeRun} />
        </Card>
      ) : null}
    </div>
  )
}
