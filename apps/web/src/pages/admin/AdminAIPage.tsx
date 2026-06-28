import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  getAdminLLMConfig,
  listAdminEvaluationJobs,
  probeAdminLLMProviders,
  updateAdminLLMConfig,
  type AdminLLMProviderProbe,
} from '@/lib/api/admin'

export default function AdminAIPage() {
  const qc = useQueryClient()
  const jobsQ = useQuery({
    queryKey: ['admin-eval-jobs'],
    queryFn: () => listAdminEvaluationJobs({ limit: 50 }),
  })
  const configQ = useQuery({
    queryKey: ['admin-llm-config'],
    queryFn: getAdminLLMConfig,
  })

  const [version, setVersion] = useState(0)
  const [chainOrder, setChainOrder] = useState('')
  const [taskMapJSON, setTaskMapJSON] = useState('')
  const [virtualChainsJSON, setVirtualChainsJSON] = useState('')
  const [probes, setProbes] = useState<AdminLLMProviderProbe[]>([])

  useEffect(() => {
    const cfg = configQ.data?.config
    if (!cfg) return
    setVersion(cfg.version)
    setChainOrder((cfg.chain_order ?? []).join(', '))
    setTaskMapJSON(cfg.task_map_json ?? '')
    setVirtualChainsJSON(cfg.virtual_chains_json ?? '')
  }, [configQ.data])

  const saveM = useMutation({
    mutationFn: () =>
      updateAdminLLMConfig({
        expected_version: version,
        chain_order: chainOrder
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        task_map_json: taskMapJSON || undefined,
        virtual_chains_json: virtualChainsJSON || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-llm-config'] })
    },
  })

  const probeM = useMutation({
    mutationFn: probeAdminLLMProviders,
    onSuccess: (data) => setProbes(data.probes ?? []),
  })

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card elevation="e1" className="p-4">
        <h2 className="mb-3 font-medium">Evaluation jobs</h2>
        {jobsQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        <ul className="max-h-[32rem] space-y-2 overflow-y-auto text-sm">
          {(jobsQ.data?.jobs ?? []).map((job) => (
            <li key={job.id} className="rounded border border-border px-3 py-2 font-mono text-xs">
              <div>{job.id}</div>
              <div className="text-text-muted">
                {job.status} · attempt {job.attempt_id} · retries {job.retry_count}
              </div>
              {job.error ? <div className="text-red-500">{job.error}</div> : null}
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-6">
        <Card elevation="e1" className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">LLM chain health</h2>
            <Button loading={probeM.isPending} variant="secondary" onClick={() => probeM.mutate()}>
              Ping chain
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Sends a minimal chat to each provider in chain order (summarize model). Unregistered providers mean a
            missing API key.
          </p>
          {probeM.isError ? (
            <p className="text-sm text-red-500">
              {probeM.error instanceof Error ? probeM.error.message : 'Probe failed'}
            </p>
          ) : null}
          {probes.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {probes.map((probe) => (
                <li
                  key={probe.provider}
                  className={`rounded border px-3 py-2 ${probe.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{probe.provider}</span>
                    <span className={probe.ok ? 'text-emerald-600' : 'text-red-500'}>
                      {probe.ok ? 'OK' : probe.registered ? 'Fail' : 'Not registered'}
                    </span>
                  </div>
                  {probe.model ? <div className="font-mono text-xs text-text-muted">{probe.model}</div> : null}
                  {probe.latency_ms > 0 ? (
                    <div className="text-xs text-text-muted">{probe.latency_ms} ms</div>
                  ) : null}
                  {probe.error ? <div className="mt-1 text-xs text-red-500">{probe.error}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Run ping to check providers in the current chain.</p>
          )}
        </Card>

        <Card elevation="e1" className="space-y-3 p-4">
          <h2 className="font-medium">LLM chain config</h2>
          <p className="text-xs text-text-muted">Version {version}. Empty chain order falls back to env LLM_CHAIN_ORDER.</p>
          <label className="block text-sm">
            Chain order (comma-separated providers)
            <input
              className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm font-mono"
              value={chainOrder}
              onChange={(e) => setChainOrder(e.target.value)}
              placeholder="groq,cerebras,openai,google"
            />
          </label>
          <label className="block text-sm">
            Task map JSON (advanced, optional)
            <textarea
              className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm font-mono"
              rows={4}
              value={taskMapJSON}
              onChange={(e) => setTaskMapJSON(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Virtual chains JSON (advanced, optional)
            <textarea
              className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm font-mono"
              rows={4}
              value={virtualChainsJSON}
              onChange={(e) => setVirtualChainsJSON(e.target.value)}
            />
          </label>
          <Button loading={saveM.isPending} onClick={() => saveM.mutate()}>
            Save config
          </Button>
          {saveM.isError ? (
            <p className="text-sm text-red-500">
              {saveM.error instanceof Error ? saveM.error.message : 'Save failed'}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
