import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { cmLanguageExt } from '@/lib/codemirror/langExtension'
import { editorAssistExtensions } from '@/lib/codemirror/editorAssist'
import { b64ToBytes, bytesToB64, useEditorWs, type EditorWsEnvelope } from '@/lib/ws/collabEditor'
import { vscodeEditorExtensions } from '@/lib/codemirror/vscodeTheme'

export type CollabCodeEditorHandle = {
  getCode: () => string
  setCode: (code: string) => void
  reconnect: () => void
}

type Props = {
  roomId: string
  language: string
  frozen: boolean
  userId?: string
  displayName?: string
  accessToken?: string
  bottomInset?: number
  fontSize?: number
  onRun?: () => void
  onFormat?: () => void
  onWsStatusChange?: (status: import('@/lib/ws/collabEditor').EditorWsStatus) => void
}

function userColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 70% 55%)`
}

export const CollabCodeEditor = forwardRef<CollabCodeEditorHandle, Props>(function CollabCodeEditor(
  {
    roomId,
    language,
    frozen,
    userId,
    displayName,
    accessToken,
    bottomInset = 0,
    fontSize = 14,
    onRun,
    onFormat,
    onWsStatusChange,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const awarenessRef = useRef<Awareness | null>(null)
  const frozenCompartment = useRef(new Compartment())
  const fontSizeCompartment = useRef(new Compartment())
  const wsSendRef = useRef<(env: EditorWsEnvelope) => boolean>(() => false)
  const sendRef = useRef<(update: Uint8Array) => void>(() => {})
  const sendSnapshotRef = useRef<(full: Uint8Array) => void>(() => {})
  const sendAwarenessRef = useRef<(update: Uint8Array) => void>(() => {})
  const onRunRef = useRef(onRun)
  const onFormatRef = useRef(onFormat)
  onRunRef.current = onRun
  onFormatRef.current = onFormat

  const token = accessToken ?? ''
  const { lastMessage, send, status, reconnect } = useEditorWs(roomId, token || undefined)

  wsSendRef.current = send

  useEffect(() => {
    onWsStatusChange?.(status)
  }, [status, onWsStatusChange])

  useImperativeHandle(ref, () => ({
    getCode: () => ydocRef.current?.getText('code').toString() ?? '',
    setCode: (code: string) => {
      const ydoc = ydocRef.current
      if (!ydoc) return
      const ytext = ydoc.getText('code')
      ydoc.transact(() => {
        ytext.delete(0, ytext.length)
        ytext.insert(0, code)
      })
    },
    reconnect,
  }))

  useEffect(() => {
    if (!lastMessage) return
    const ydoc = ydocRef.current
    const awareness = awarenessRef.current
    if (!ydoc) return

    if (lastMessage.kind === 'snapshot' || lastMessage.kind === 'op') {
      const data = lastMessage.data as { payload?: string | Uint8Array } | undefined
      const payload = data?.payload
      if (typeof payload === 'string') {
        Y.applyUpdate(ydoc, b64ToBytes(payload), 'remote')
      } else if (payload instanceof Uint8Array) {
        Y.applyUpdate(ydoc, payload, 'remote')
      }
    } else if (lastMessage.kind === 'presence' && awareness) {
      const data = lastMessage.data as { data?: { update?: string }; update?: string } | undefined
      const b64 = data?.data?.update ?? data?.update
      if (typeof b64 === 'string') {
        try {
          applyAwarenessUpdate(awareness, b64ToBytes(b64), 'remote')
        } catch {
          /* ignore */
        }
      }
    }
  }, [lastMessage])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !token) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const ytext = ydoc.getText('code')
    const awareness = new Awareness(ydoc)
    awarenessRef.current = awareness

    const label = displayName ?? userId?.slice(0, 8) ?? 'you'
    awareness.setLocalStateField('user', {
      name: label,
      color: userColor(userId ?? roomId),
    })

    let snapshotTimer: number | null = null
    const sendFullSnapshot = () => {
      const full = Y.encodeStateAsUpdate(ydoc)
      if (full.byteLength > 0) sendSnapshotRef.current(full)
    }
    const scheduleSnapshot = () => {
      if (snapshotTimer !== null) window.clearTimeout(snapshotTimer)
      snapshotTimer = window.setTimeout(() => {
        snapshotTimer = null
        sendFullSnapshot()
      }, 1500)
    }

    const onYUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      sendRef.current(update)
      scheduleSnapshot()
    }
    ydoc.on('update', onYUpdate)

    const onAwUpdate = (
      diff: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === 'remote') return
      const changed = diff.added.concat(diff.updated, diff.removed)
      if (changed.length === 0) return
      sendAwarenessRef.current?.(encodeAwarenessUpdate(awareness, changed))
    }
    awareness.on('update', onAwUpdate)

    sendRef.current = (update) => {
      wsSendRef.current({ kind: 'op', data: { payload: bytesToB64(update) } })
    }
    sendSnapshotRef.current = (full) => {
      wsSendRef.current({ kind: 'snapshot', data: { payload: bytesToB64(full) } })
    }
    sendAwarenessRef.current = (update) => {
      wsSendRef.current({ kind: 'presence', data: { update: bytesToB64(update) } })
    }

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        cmLanguageExt(language),
        editorAssistExtensions,
        ...vscodeEditorExtensions,
        fontSizeCompartment.current.of(
          EditorView.theme({
            '&': { fontSize: `${fontSize}px` },
            '.cm-content': { fontSize: `${fontSize}px` },
            '.cm-gutters': { fontSize: `${fontSize}px` },
          }),
        ),
        yCollab(ytext, awareness),
        frozenCompartment.current.of(EditorView.editable.of(!frozen)),
      ],
    })
    const view = new EditorView({ state, parent: mount })
    viewRef.current = view

    return () => {
      try {
        sendFullSnapshot()
      } catch {
        /* ignore */
      }
      if (snapshotTimer !== null) window.clearTimeout(snapshotTimer)
      ydoc.off('update', onYUpdate)
      awareness.off('update', onAwUpdate)
      view.destroy()
      viewRef.current = null
      awareness.destroy()
      ydoc.destroy()
      ydocRef.current = null
      awarenessRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token/room/language only
  }, [roomId, language, token])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: frozenCompartment.current.reconfigure(EditorView.editable.of(!frozen)),
    })
  }, [frozen])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: fontSizeCompartment.current.reconfigure(
        EditorView.theme({
          '&': { fontSize: `${fontSize}px` },
          '.cm-content': { fontSize: `${fontSize}px` },
          '.cm-gutters': { fontSize: `${fontSize}px` },
        }),
      ),
    })
  }, [fontSize])

  useEffect(() => {
    const awareness = awarenessRef.current
    if (!awareness) return
    const label = displayName ?? userId?.slice(0, 8) ?? 'you'
    awareness.setLocalStateField('user', {
      name: label,
      color: userColor(userId ?? roomId),
    })
  }, [displayName, userId, roomId])

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
      className="absolute inset-0 always-show-cursor-labels"
      style={{
        paddingBottom: bottomInset,
        transition: 'padding-bottom var(--motion-dur-medium) var(--motion-ease-standard)',
      }}
    />
  )
})

export function wsStatusLabel(status: string, frozen: boolean): string {
  if (frozen) return 'FROZEN'
  switch (status) {
    case 'open':
      return 'LIVE'
    case 'failed':
      return 'OFFLINE'
    case 'reconnecting':
      return 'RECONNECT…'
    case 'connecting':
      return 'CONNECT…'
    default:
      return status.toUpperCase()
  }
}

export function wsStatusColor(status: string, frozen: boolean): string {
  if (frozen) return 'var(--red)'
  if (status === 'open') return 'rgb(var(--ink))'
  if (status === 'failed') return 'var(--red)'
  return 'var(--ink-60)'
}
