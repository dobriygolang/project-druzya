import { go } from '@codemirror/lang-go'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import type { Extension } from '@codemirror/state'

export type EditorLangShort = 'go' | 'python' | 'javascript' | 'typescript'

export function normalizeEditorLang(language: string | undefined): EditorLangShort {
  const s = String(language ?? '').toLowerCase()
  if (s.includes('python')) return 'python'
  if (s.includes('typescript')) return 'typescript'
  if (s.includes('javascript')) return 'javascript'
  return 'go'
}

export function cmLanguageExt(language: string): Extension {
  switch (normalizeEditorLang(language)) {
    case 'go':
      return go()
    case 'python':
      return python()
    case 'typescript':
      return javascript({ typescript: true })
    case 'javascript':
      return javascript()
    default:
      return go()
  }
}
