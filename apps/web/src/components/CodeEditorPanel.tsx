import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LiveCodeRunButton, LiveCodeToolButton } from '@/components/live/LiveCodeChrome'
import { RunOutputPanel, runPanelHeight } from '@/components/live/RunOutputPanel'
import { SoloCodeEditor } from '@/components/SoloCodeEditor'
import { useFormatCode } from '@/hooks/useFormatCode'
import { useSandboxRun } from '@/hooks/useSandboxRun'
import { isTerminalRunStatus } from '@/lib/api/sandbox'
import {
  mergeEditorPreset,
  readEditorPreset,
  taskHasSandboxTests,
  taskRequiresSandboxVerify,
} from '@/lib/interview/editorPreset'
import { normalizeEditorLang } from '@/lib/codemirror/langExtension'
import { useI18n } from '@/lib/i18n'
import type { CodeRun } from '@/lib/types'

function isSuccessfulSubmitRun(run: CodeRun | undefined): boolean {
  return (
    !!run &&
    isTerminalRunStatus(run.status) &&
    run.run_type === 'submit' &&
    run.status === 'success'
  )
}

interface CodeEditorPanelProps {
  taskId: string
  sessionTaskId: string
  taskMetadata?: Record<string, unknown>
  language: string
  onLanguageChange: (lang: string) => void
  code: string
  onCodeChange: (code: string) => void
  verifiedSubmitRunId: string | null
  onVerifiedSubmitRunChange: (runId: string | null) => void
  onSubmit: () => void
  submitPending: boolean
}

const LANG_OPTIONS = [
  { value: 'go', label: 'Go' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
] as const

const EDITOR_MIN_H = 540

export function CodeEditorPanel({
  taskId,
  sessionTaskId,
  taskMetadata,
  language,
  onLanguageChange,
  code,
  onCodeChange,
  verifiedSubmitRunId,
  onVerifiedSubmitRunChange,
  onSubmit,
  submitPending,
}: CodeEditorPanelProps) {
  const { t } = useI18n()
  const run = useSandboxRun()
  const fmt = useFormatCode()
  const [fullCheckPending, setFullCheckPending] = useState(false)
  const panelBottom = runPanelHeight(run.panelOpen)
  const isGo = normalizeEditorLang(language) === 'go'
  const hasTests = taskHasSandboxTests(taskMetadata)
  const requiresVerify = taskRequiresSandboxVerify(taskMetadata)
  const canSubmit = Boolean(code.trim()) && !run.running && (!requiresVerify || verifiedSubmitRunId)

  useEffect(() => {
    onVerifiedSubmitRunChange(null)
  }, [code, language, onVerifiedSubmitRunChange])

  useEffect(() => {
    if (isSuccessfulSubmitRun(run.activeRun)) {
      onVerifiedSubmitRunChange(run.activeRun!.id)
    }
  }, [run.activeRun, onVerifiedSubmitRunChange])

  const runnableCode = mergeEditorPreset(taskMetadata, language, code)

  const handleFormat = async () => {
    if (!code.trim() || fmt.formatting) return
    const target = readEditorPreset(taskMetadata)?.[language]?.harness ? code : runnableCode
    const formatted = await fmt.format(language, target)
    if (formatted != null) onCodeChange(formatted)
  }

  const handleRun = (runType: 'sample' | 'submit') => {
    if (!code.trim() || run.running) return
    void run.executeRun({ taskId, sessionTaskId, language, code: runnableCode, runType })
  }

  const handleFullCheck = async () => {
    if (!code.trim() || run.running) return
    setFullCheckPending(true)
    try {
      await run.executeRun({ taskId, sessionTaskId, language, code: runnableCode, runType: 'submit' })
    } finally {
      setFullCheckPending(false)
    }
  }

  const lineCount = code.length === 0 ? 0 : code.split('\n').length

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e]">
        <div className="relative" style={{ minHeight: EDITOR_MIN_H }}>
          <SoloCodeEditor
            value={code}
            onChange={onCodeChange}
            language={language}
            bottomInset={panelBottom}
            onRun={hasTests ? () => handleRun('sample') : undefined}
            onFormat={isGo ? () => void handleFormat() : undefined}
          />

          {hasTests ? (
            <div className="absolute top-3 right-4 z-[25] flex items-center gap-2">
              <LiveCodeRunButton
                running={run.running}
                onRun={() => handleRun('sample')}
                disabled={!code.trim()}
                title={t('session.editorRunTitle')}
              />
              {isGo ? (
                <LiveCodeToolButton
                  loading={fmt.formatting}
                  onClick={() => void handleFormat()}
                  title={t('session.editorFmtTitle')}
                >
                  {t('session.editorFmt')}
                </LiveCodeToolButton>
              ) : null}
              <LiveCodeToolButton
                loading={fullCheckPending}
                onClick={() => void handleFullCheck()}
                title={t('session.editorVerifyTitle')}
              >
                {t('session.editorVerify')}
              </LiveCodeToolButton>
            </div>
          ) : null}

          <RunOutputPanel
            open={run.panelOpen}
            onClose={() => run.setPanelOpen(false)}
            tab={run.outputTab}
            onTabChange={run.setOutputTab}
            run={run.activeRun}
            running={run.running}
            error={run.runError}
            placement="contained"
            panelLabel={t('session.editorOutput')}
            closeTitle={t('session.editorOutputClose')}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="lang" className="sr-only">
              Язык
            </label>
            <select
              id="lang"
              value={normalizeEditorLang(language)}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-xs text-[#d4d4d4] outline-none"
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1e1e1e]">
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="font-mono text-[10px] tracking-[0.06em] text-[#858585]">
              {lineCount} lines · {code.length} chars
            </span>
          </div>
          <Button loading={submitPending} disabled={!canSubmit} onClick={onSubmit} size="sm">
            {t('session.editorSubmit')}
          </Button>
        </div>
      </div>

      {requiresVerify ? (
        verifiedSubmitRunId ? (
          <p className="text-sm text-text-secondary">{t('session.editorVerifyOk')}</p>
        ) : (
          <p className="text-sm text-text-muted">{t('session.editorVerifyHint')}</p>
        )
      ) : (
        <p className="text-sm text-text-muted">{t('session.editorSubmitDirectHint')}</p>
      )}

      {fmt.formatError ? <p className="text-sm text-danger">{fmt.formatError}</p> : null}

      {run.activeRun && run.activeRun.test_results.length > 0 ? (
        <Card elevation="e2" padding="md">
          <p className="mb-3 text-sm font-medium">{t('session.editorTests')}</p>
          <ul className="space-y-2 font-mono text-xs">
            {run.activeRun.test_results.map((tr) => (
              <li key={tr.name} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex justify-between gap-2">
                  <span>{tr.name}</span>
                  <span className={tr.status === 'passed' ? 'text-text-primary' : 'text-danger'}>
                    {tr.status}
                  </span>
                </div>
                {tr.error ? <p className="mt-1 text-danger">{tr.error}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
