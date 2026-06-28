import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { go } from '@codemirror/lang-go'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { b64ToBytes, bytesToB64, useEditorWs, type EditorWsEnvelope } from '@/lib/ws/collabEditor'
import { vscodeEditorExtensions } from '@/lib/codemirror/vscodeTheme'

type Props = {
  roomId: string
  language: string
  frozen: boolean
  userId?: string
  displayName?: string
  accessToken?: string
}

function langExt(language: string) {
  switch (language) {
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

function userColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 70% 55%)`
}

function wsStatusLabel(status: string, frozen: boolean): string {
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

function wsStatusColor(status: string, frozen: boolean): string {
  if (frozen) return 'var(--red)'
  if (status === 'open') return 'rgb(var(--ink))'
  if (status === 'failed') return 'var(--red)'
  return 'var(--ink-60)'
}

export function CollabCodeEditor({
  roomId,
  language,
  frozen,
  userId,
  displayName,
  accessToken,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const awarenessRef = useRef<Awareness | null>(null)
  const frozenCompartment = useRef(new Compartment())
  const wsSendRef = useRef<(env: EditorWsEnvelope) => boolean>(() => false)

  const token = accessToken ?? ''
  const { status, lastMessage, send, reconnect } = useEditorWs(roomId, token || undefined)

  wsSendRef.current = send

  const sendRef = useRef<(update: Uint8Array) => void>(() => {})
  const sendSnapshotRef = useRef<(full: Uint8Array) => void>(() => {})
  const sendAwarenessRef = useRef<(update: Uint8Array) => void>(() => {})

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

  // Mount editor once per room/language/token — never depend on `send` or WS status.
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
        langExt(language),
        ...vscodeEditorExtensions,
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

  // Toggle frozen without remounting editor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: frozenCompartment.current.reconfigure(EditorView.editable.of(!frozen)),
    })
  }, [frozen])

  // Update awareness label when user info arrives.
  useEffect(() => {
    const awareness = awarenessRef.current
    if (!awareness) return
    const label = displayName ?? userId?.slice(0, 8) ?? 'you'
    awareness.setLocalStateField('user', {
      name: label,
      color: userColor(userId ?? roomId),
    })
  }, [displayName, userId, roomId])

  return (
    <div className="relative h-full min-h-0 flex-1">
      <div ref={mountRef} className="absolute inset-0 always-show-cursor-labels" />

      <div
        className="pointer-events-none fixed bottom-4 right-6 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(20,20,22,0.78)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.08em] backdrop-blur-md"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
        <span className="text-[#858585]">{language.toUpperCase()}</span>
        <span className="text-[#858585]">·</span>
        <span style={{ color: wsStatusColor(status, frozen) }}>{wsStatusLabel(status, frozen)}</span>
        {status === 'failed' ? (
          <button
            type="button"
            className="pointer-events-auto ml-1 underline"
            style={{ color: 'var(--red)' }}
            onClick={reconnect}
          >
            retry
          </button>
        ) : null}
      </div>
    </div>
  )
}
