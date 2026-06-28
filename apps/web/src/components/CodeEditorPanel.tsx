import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LiveCodeRunButton, LiveCodeToolButton } from '@/components/live/LiveCodeChrome'
import { RunOutputPanel, runPanelHeight } from '@/components/live/RunOutputPanel'
import { SoloCodeEditor } from '@/components/SoloCodeEditor'
import { useFormatCode } from '@/hooks/useFormatCode'
import { useSandboxRun } from '@/hooks/useSandboxRun'
import { normalizeEditorLang } from '@/lib/codemirror/langExtension'

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

const LANG_OPTIONS = [
  { value: 'go', label: 'Go' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
] as const

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
  const run = useSandboxRun()
  const fmt = useFormatCode()
  const [fullCheckPending, setFullCheckPending] = useState(false)
  const panelBottom = runPanelHeight(run.panelOpen)
  const isGo = normalizeEditorLang(language) === 'go'

  const handleFormat = async () => {
    if (!code.trim() || fmt.formatting) return
    const formatted = await fmt.format(language, code)
    if (formatted != null) onCodeChange(formatted)
  }

  const handleRun = (runType: 'sample' | 'submit') => {
    if (!code.trim() || run.running) return
    void run.executeRun({ taskId, sessionTaskId, language, code, runType })
  }

  const handleFullCheck = async () => {
    if (!code.trim() || run.running) return
    setFullCheckPending(true)
    try {
      await run.executeRun({ taskId, sessionTaskId, language, code, runType: 'submit' })
    } finally {
      setFullCheckPending(false)
    }
  }

  const lineCount = code.length === 0 ? 0 : code.split('\n').length

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e]">
        <div className="relative min-h-[420px]">
          <SoloCodeEditor
            value={code}
            onChange={onCodeChange}
            language={language}
            bottomInset={panelBottom}
            onRun={() => handleRun('sample')}
            onFormat={isGo ? () => void handleFormat() : undefined}
          />

          <div className="absolute top-3 right-4 z-[25] flex items-center gap-2">
            <LiveCodeRunButton
              running={run.running}
              onRun={() => handleRun('sample')}
              disabled={!code.trim()}
            />
            {isGo ? (
              <LiveCodeToolButton
                loading={fmt.formatting}
                onClick={() => void handleFormat()}
                title="gofmt (⌘⇧F)"
              >
                FMT
              </LiveCodeToolButton>
            ) : null}
            <LiveCodeToolButton
              loading={fullCheckPending}
              onClick={() => void handleFullCheck()}
              title="Полная проверка"
            >
              FULL
            </LiveCodeToolButton>
          </div>

          <RunOutputPanel
            open={run.panelOpen}
            onClose={() => run.setPanelOpen(false)}
            tab={run.outputTab}
            onTabChange={run.setOutputTab}
            run={run.activeRun}
            running={run.running}
            error={run.runError}
            placement="contained"
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
          <Button
            loading={submitPending}
            disabled={submitDisabled || !code.trim() || run.running}
            onClick={onSubmit}
            size="sm"
          >
            Отправить на оценку
          </Button>
        </div>
      </div>

      {fmt.formatError ? (
        <p className="text-sm text-danger">{fmt.formatError}</p>
      ) : null}

      {run.activeRun && run.activeRun.test_results.length > 0 ? (
        <Card elevation="e2" padding="md">
          <p className="mb-3 text-sm font-medium">Тесты</p>
          <ul className="space-y-2 font-mono text-xs">
            {run.activeRun.test_results.map((t) => (
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
        </Card>
      ) : null}
    </div>
  )
}
