import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'

import type { HoneDemoLabels } from './types'

interface NotesPanelProps {
  labels: HoneDemoLabels
  compact?: boolean
  typedText?: string
  readOnly?: boolean
}

export function NotesPanel({ labels, compact, typedText, readOnly = false }: NotesPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const fullText = `# ${labels.noteTitle}\n\n${labels.noteBody}`
  const displayText = typedText ?? fullText

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const isTyping = typedText !== undefined

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: displayText,
        extensions: [
          lineNumbers(),
          history(),
          markdown(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.editable.of(!readOnly && !isTyping),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: compact ? '11px' : '12px',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit' },
            '.cm-content': {
              padding: compact ? '10px 12px' : '14px 16px',
              caretColor: 'var(--ink)',
            },
            '.cm-gutters': {
              background: 'transparent',
              border: 'none',
              color: 'rgb(var(--ink-rgb) / 0.35)',
            },
            '.cm-lineNumbers .cm-gutterElement': { minWidth: '24px' },
            '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--ink)' },
            '.cm-activeLine': { background: 'rgb(var(--ink-rgb) / 0.03)' },
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [compact, readOnly, typedText !== undefined])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (cur !== displayText) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: displayText },
      })
    }
  }, [displayText])

  return (
    <div className="hone-demo-panel hone-demo-panel--notes">
      <div ref={hostRef} className="hone-demo-notes-editor" />
    </div>
  )
}
