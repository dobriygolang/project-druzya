import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { go } from '@codemirror/lang-go'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { b64ToBytes, bytesToB64, useEditorWs } from '@/lib/ws/collabEditor'
import { readAccessToken } from '@/lib/apiClient'

type Props = {
  roomId: string
  language: string
  frozen: boolean
  userId?: string
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

export function CollabCodeEditor({ roomId, language, frozen, userId, accessToken }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const awarenessRef = useRef<Awareness | null>(null)
  const token = accessToken ?? readAccessToken() ?? ''
  const { status, lastMessage, send, reconnect } = useEditorWs(roomId, token)
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

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !token) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const ytext = ydoc.getText('code')
    const awareness = new Awareness(ydoc)
    awarenessRef.current = awareness
    awareness.setLocalStateField('user', {
      name: userId?.slice(0, 8) ?? 'you',
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
      send({ kind: 'op', data: { payload: bytesToB64(update) } })
    }
    sendSnapshotRef.current = (full) => {
      send({ kind: 'snapshot', data: { payload: bytesToB64(full) } })
    }
    sendAwarenessRef.current = (update) => {
      send({ kind: 'presence', data: { update: bytesToB64(update) } })
    }

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        langExt(language),
        oneDark,
        yCollab(ytext, awareness),
        EditorView.editable.of(!frozen),
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
  }, [roomId, language, token, userId, send, frozen, accessToken])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          WS:{' '}
          <span
            className={
              status === 'open'
                ? 'text-green-600'
                : status === 'failed'
                  ? 'text-red-600'
                  : 'text-amber-600'
            }
          >
            {status}
          </span>
          {frozen ? ' · frozen' : ''}
        </span>
        {status === 'failed' ? (
          <button type="button" className="underline" onClick={reconnect}>
            Reconnect
          </button>
        ) : null}
      </div>
      <div
        ref={mountRef}
        className="min-h-[420px] overflow-hidden rounded-lg border border-neutral-200 text-left"
      />
    </div>
  )
}
