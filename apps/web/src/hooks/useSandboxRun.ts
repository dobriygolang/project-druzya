import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { getCodeRun, isTerminalRunStatus, runCode, type RunType } from '@/lib/api/sandbox'
import type { CodeRun } from '@/lib/types'

export function useSandboxRun() {
  const [runId, setRunId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [outputTab, setOutputTab] = useState<'stdout' | 'stderr'>('stdout')
  const [runError, setRunError] = useState<string | null>(null)

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
    mutationFn: (input: {
      taskId?: string
      sessionTaskId?: string
      language: string
      code: string
      runType: RunType
    }) => runCode(input),
    onSuccess: (data) => {
      setRunId(data.run.id)
      setRunError(null)
      const run = data.run
      if (run.stderr && !run.stdout) setOutputTab('stderr')
      else setOutputTab('stdout')
    },
    onError: (err) => {
      setRunError(err instanceof Error ? err.message : 'Run failed')
      setRunId(null)
    },
  })

  const activeRun = runQ.data?.run
  const running =
    runM.isPending || (activeRun != null && !isTerminalRunStatus(activeRun.status))

  const executeRun = useCallback(
    async (input: {
      taskId?: string
      sessionTaskId?: string
      language: string
      code: string
      runType?: RunType
    }) => {
      if (running) return
      setPanelOpen(true)
      setRunError(null)
      await runM.mutateAsync({
        ...input,
        runType: input.runType ?? (input.taskId ? 'sample' : 'custom'),
      })
    },
    [runM, running],
  )

  return {
    panelOpen,
    setPanelOpen,
    outputTab,
    setOutputTab,
    runError,
    running,
    activeRun: activeRun as CodeRun | undefined,
    executeRun,
  }
}
