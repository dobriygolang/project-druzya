const SOLUTION_PLACEHOLDER = '{{SOLUTION}}'

export type EditorPresetLang = {
  solution?: string
  harness?: string
}

export type TaskEditorPreset = Record<string, EditorPresetLang>

export function readEditorPreset(metadata: Record<string, unknown> | undefined): TaskEditorPreset | null {
  const raw = metadata?.editor_preset
  if (!raw || typeof raw !== 'object') return null
  return raw as TaskEditorPreset
}

export function readStarterCode(metadata: Record<string, unknown> | undefined): Record<string, string> | null {
  const raw = metadata?.starter_code
  if (!raw || typeof raw !== 'object') return null
  const out: Record<string, string> = {}
  for (const [lang, code] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof code === 'string') out[lang] = code
  }
  return Object.keys(out).length ? out : null
}

/** Initial editable buffer: solution stub when preset exists, else legacy starter_code. */
export function initialEditorSolution(
  metadata: Record<string, unknown> | undefined,
  language: string,
): string {
  const preset = readEditorPreset(metadata)?.[language]
  if (preset?.solution) return preset.solution
  const starter = readStarterCode(metadata)?.[language]
  return starter ?? ''
}

/** Merge user solution into harness for sandbox execution. */
export function mergeEditorPreset(
  metadata: Record<string, unknown> | undefined,
  language: string,
  userCode: string,
): string {
  const preset = readEditorPreset(metadata)?.[language]
  if (preset?.harness?.includes(SOLUTION_PLACEHOLDER)) {
    return preset.harness.replaceAll(SOLUTION_PLACEHOLDER, userCode.trim())
  }
  return userCode
}

export function taskHasSandboxTests(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false
  if (metadata.execution === 'none') return false
  const hasCases = (key: string) => {
    const val = metadata[key]
    return Array.isArray(val) && val.length > 0
  }
  return hasCases('examples') || hasCases('test_cases') || hasCases('hidden_test_cases')
}

export function taskRequiresSandboxVerify(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.sandbox_required === true
}
