import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { yCollab } from 'y-codemirror.next'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { cmLanguageExt } from '@/lib/codemirror/langExtension'
import { editorAssistExtensions } from '@/lib/codemirror/editorAssist'
import { collabUserColors } from '@/lib/codemirror/collabColors'
import { peersFromAwareness, type CollabPeer } from '@/lib/codemirror/collabPresence'
import { bytesToB64, applyWsEnvelope, useEditorWs, type EditorWsEnvelope } from '@/lib/ws/collabEditor'
import { vscodeLightEditorExtensions } from '@/lib/codemirror/vscodeTheme'

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
  onPeersChange?: (peers: CollabPeer[]) => void
  onWsStatusChange?: (status: import('@/lib/ws/collabEditor').EditorWsStatus) => void
}

function isTabActive(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
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
    onPeersChange,
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
  const onPeersChangeRef = useRef(onPeersChange)
  const pendingEnvelopesRef = useRef<EditorWsEnvelope[]>([])
  onRunRef.current = onRun
  onFormatRef.current = onFormat
  onPeersChangeRef.current = onPeersChange

  const token = accessToken ?? ''

  const handleWsEnvelope = useCallback((env: EditorWsEnvelope) => {
    const ydoc = ydocRef.current
    const awareness = awarenessRef.current
    if (!ydoc) {
      pendingEnvelopesRef.current.push(env)
      return
    }
    applyWsEnvelope(env, ydoc, awareness)
  }, [])

  const flushPendingEnvelopes = useCallback(() => {
    const ydoc = ydocRef.current
    const awareness = awarenessRef.current
    if (!ydoc) return
    const pending = pendingEnvelopesRef.current
    if (pending.length === 0) return
    pendingEnvelopesRef.current = []
    for (const env of pending) {
      applyWsEnvelope(env, ydoc, awareness)
    }
  }, [])

  const { send, status, reconnect } = useEditorWs(roomId, token || undefined, handleWsEnvelope)

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
    const mount = mountRef.current
    if (!mount || !token) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const ytext = ydoc.getText('code')
    const awareness = new Awareness(ydoc)
    awarenessRef.current = awareness

    const label = displayName ?? userId?.slice(0, 8) ?? 'you'
    const colors = collabUserColors(userId ?? roomId)
    const syncLocalUser = (active = isTabActive()) => {
      awareness.setLocalStateField('user', {
        name: label,
        color: colors.color,
        colorLight: colors.colorLight,
        userId: userId ?? roomId,
        active,
      })
    }
    syncLocalUser()

    const emitPeers = () => {
      onPeersChangeRef.current?.(peersFromAwareness(awareness))
    }
    const onTabActivity = () => syncLocalUser(isTabActive())
    document.addEventListener('visibilitychange', onTabActivity)
    window.addEventListener('focus', onTabActivity)
    window.addEventListener('blur', onTabActivity)
    awareness.on('change', emitPeers)
    emitPeers()

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
        ...vscodeLightEditorExtensions,
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
    flushPendingEnvelopes()

    return () => {
      pendingEnvelopesRef.current = []
      try {
        sendFullSnapshot()
      } catch {
        /* ignore */
      }
      document.removeEventListener('visibilitychange', onTabActivity)
      window.removeEventListener('focus', onTabActivity)
      window.removeEventListener('blur', onTabActivity)
      awareness.off('change', emitPeers)
      awareness.setLocalState(null)
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
  }, [roomId, language, token, flushPendingEnvelopes])

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
    const colors = collabUserColors(userId ?? roomId)
    const prev = awareness.getLocalState()?.user as Record<string, unknown> | undefined
    awareness.setLocalStateField('user', {
      ...prev,
      name: label,
      color: colors.color,
      colorLight: colors.colorLight,
      userId: userId ?? roomId,
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
