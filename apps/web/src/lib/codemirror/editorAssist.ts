import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/** Autocomplete, bracket closing, and completion keybindings for code editors. */
export const editorAssistExtensions: Extension[] = [
  autocompletion(),
  closeBrackets(),
  keymap.of([...closeBracketsKeymap, ...completionKeymap]),
]
