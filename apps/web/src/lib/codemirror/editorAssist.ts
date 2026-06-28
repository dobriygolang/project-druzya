import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { EditorView, keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

const autocompleteTheme = EditorView.theme({
  '.cm-tooltip.cm-tooltip-autocomplete': {
    backgroundColor: '#252526',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: '12px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: '#094771',
    color: '#fff',
  },
  '.cm-completionDetail': {
    color: '#858585',
    fontStyle: 'normal',
    marginLeft: '8px',
  },
  '.cm-completionInfo': {
    backgroundColor: '#1e1e1e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    padding: '6px 8px',
    maxWidth: '320px',
    color: '#ccc',
    fontSize: '11px',
  },
  '.cm-completionIcon-function::after': { content: "'ƒ'" },
  '.cm-completionIcon-class::after': { content: "'C'" },
  '.cm-completionIcon-namespace::after': { content: "'◆'" },
  '.cm-completionIcon-variable::after': { content: "'x'" },
  '.cm-completionIcon-constant::after': { content: "'c'" },
  '.cm-completionIcon-type::after': { content: "'T'" },
  '.cm-completionIcon-keyword::after': { content: "'#'" },
})

/** Autocomplete, bracket closing, and completion keybindings for code editors. */
export const editorAssistExtensions: Extension[] = [
  autocompletion({
    activateOnTyping: true,
    activateOnTypingDelay: 80,
    maxRenderedOptions: 24,
    icons: true,
    defaultKeymap: true,
    closeOnBlur: true,
    updateSyncTime: 30,
  }),
  closeBrackets(),
  autocompleteTheme,
  keymap.of([...closeBracketsKeymap, ...completionKeymap]),
]
