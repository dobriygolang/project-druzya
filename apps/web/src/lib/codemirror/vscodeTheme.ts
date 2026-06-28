import { HighlightStyle, syntaxHighlighting, indentOnInput } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { EditorView } from '@codemirror/view'

/** VSCode-dark theme — ported from druzya/frontend EditorPage.tsx */
export const vscodeHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#569cd6', fontWeight: '500' },
  { tag: [t.controlKeyword, t.moduleKeyword], color: '#c586c0' },
  { tag: [t.string, t.special(t.string), t.character], color: '#ce9178' },
  { tag: [t.number, t.atom], color: '#b5cea8' },
  { tag: t.bool, color: '#569cd6' },
  { tag: t.null, color: '#569cd6' },
  { tag: t.literal, color: '#b5cea8' },
  { tag: [t.constant(t.variableName), t.constant(t.propertyName)], color: '#4fc1ff' },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: '#6a9955',
    fontStyle: 'italic',
  },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: '#dcdcaa' },
  { tag: t.macroName, color: '#c586c0' },
  { tag: [t.typeName, t.className, t.namespace, t.angleBracket], color: '#4ec9b0' },
  { tag: t.variableName, color: '#9cdcfe' },
  { tag: t.propertyName, color: '#9cdcfe' },
  { tag: [t.standard(t.variableName), t.special(t.variableName), t.self], color: '#569cd6' },
  { tag: [t.operator, t.punctuation], color: '#d4d4d4' },
  { tag: t.bracket, color: '#d4d4d4' },
  { tag: t.tagName, color: '#569cd6' },
  { tag: t.attributeName, color: '#9cdcfe' },
  { tag: t.regexp, color: '#d16969' },
  { tag: t.escape, color: '#d7ba7d' },
])

export function vscodeTheme() {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        fontSize: '14px',
        fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      },
      '.cm-content': { caretColor: '#aeafad', padding: '20px 24px' },
      '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#858585', border: 'none' },
      '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#c6c6c6' },
      '.cm-cursor': { borderLeftColor: '#aeafad', borderLeftWidth: '1.5px' },
      '.cm-selectionBackground, ::selection': { backgroundColor: '#264f78' },
      '&.cm-focused .cm-selectionBackground': { backgroundColor: '#264f78' },
    },
    { dark: true },
  )
}

export const vscodeEditorExtensions = [
  indentOnInput(),
  syntaxHighlighting(vscodeHighlight),
  vscodeTheme(),
]
