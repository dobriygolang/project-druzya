import type { Extension } from '@codemirror/state'
import { normalizeEditorLang } from '@/lib/codemirror/langExtension'
import { goSmartCompletion } from './goCompletions'
import { jsSmartCompletion } from './jsCompletions'
import { pythonSmartCompletion } from './pythonCompletions'

export function smartCompletionFor(language: string): Extension {
  switch (normalizeEditorLang(language)) {
    case 'go':
      return goSmartCompletion
    case 'python':
      return pythonSmartCompletion
    case 'javascript':
    case 'typescript':
      return jsSmartCompletion
    default:
      return goSmartCompletion
  }
}
