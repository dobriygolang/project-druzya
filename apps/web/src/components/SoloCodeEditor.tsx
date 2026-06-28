import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { cmLanguageExt, normalizeEditorLang } from '@/lib/codemirror/langExtension'
import { editorAssistExtensions } from '@/lib/codemirror/editorAssist'
import { vscodeEditorExtensions } from '@/lib/codemirror/vscodeTheme'
import { goLspEnabled } from '@/lib/codemirror/lsp/goLspTransport'
import { createGoLspExtension } from '@/lib/codemirror/lsp/goLsp'

type Props = {
  value: string
  onChange: (code: string) => void
  language: string
  readOnly?: boolean
  bottomInset?: number
  onRun?: () => void
  onFormat?: () => void
  className?: string
}

export function SoloCodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  bottomInset = 0,
  onRun,
  onFormat,
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyCompartment = useRef(new Compartment())
  const lspCompartment = useRef(new Compartment())
  const languageCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  const onFormatRef = useRef(onFormat)
  const syncingRef = useRef(false)
  onChangeRef.current = onChange
  onRunRef.current = onRun
  onFormatRef.current = onFormat

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const useLsp = goLspEnabled() && normalizeEditorLang(language) === 'go'

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        languageCompartment.current.of(cmLanguageExt(language)),
        editorAssistExtensions,
        ...vscodeEditorExtensions,
        lspCompartment.current.of([]),
        readOnlyCompartment.current.of(EditorView.editable.of(!readOnly)),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged || syncingRef.current) return
          onChangeRef.current(u.state.doc.toString())
        }),
      ],
    })
    const view = new EditorView({ state, parent: mount })
    viewRef.current = view

    let lspDispose: (() => void) | undefined
    if (useLsp) {
      void createGoLspExtension().then((lsp) => {
        if (!lsp || !viewRef.current) {
          lsp?.dispose()
          return
        }
        lspDispose = lsp.dispose
        viewRef.current.dispatch({
          effects: [
            languageCompartment.current.reconfigure(cmLanguageExt(language, { lsp: true })),
            lspCompartment.current.reconfigure(lsp.extension),
          ],
        })
      })
    }

    return () => {
      lspDispose?.()
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per language
  }, [language])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorView.editable.of(!readOnly)),
    })
  }, [readOnly])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    syncingRef.current = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
    syncingRef.current = false
  }, [value])

  useEffect(() => {
    if (!onRun && !onFormat) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onRunRef.current?.()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        onFormatRef.current?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRun, onFormat])

  return (
    <div
      ref={mountRef}
      className={className ?? 'absolute inset-0 always-show-cursor-labels'}
      style={{
        paddingBottom: bottomInset,
        transition: 'padding-bottom var(--motion-dur-medium) var(--motion-ease-standard)',
      }}
    />
  )
}
