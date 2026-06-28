import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { patchSystemDesignWorkspace } from '@/lib/api/systemDesign'
import { collabUserColors } from '@/lib/codemirror/collabColors'
import { peersFromAwareness, type CollabPeer } from '@/lib/codemirror/collabPresence'
import { getSystemDesignWorkspace } from '@/lib/api/systemDesign'
import {
  applyWsEnvelope,
  bytesToB64,
  useEditorWs,
  type EditorWsEnvelope,
} from '@/lib/ws/collabEditor'

export type CollabExcalidrawHandle = {
  getSceneJSON: () => string
  reconnect: () => void
}

type ScenePayload = {
  elements: unknown[]
  files?: Record<string, unknown>
}

type Props = {
  roomId: string
  frozen: boolean
  userId?: string
  displayName?: string
  accessToken?: string
  sessionTaskId?: string
  workspaceVersion?: number
  onPeersChange?: (peers: CollabPeer[]) => void
  onWsStatusChange?: (status: import('@/lib/ws/collabEditor').EditorWsStatus) => void
}

function parseScene(raw: string): ScenePayload {
  if (!raw.trim()) return { elements: [], files: {} }
  try {
    const parsed = JSON.parse(raw) as ScenePayload
    return {
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : {},
    }
  } catch {
    return { elements: [], files: {} }
  }
}

function isTabActive(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}

export const CollabExcalidrawEditor = forwardRef<CollabExcalidrawHandle, Props>(
  function CollabExcalidrawEditor(
    {
      roomId,
      frozen,
      userId,
      displayName,
      accessToken,
      sessionTaskId,
      workspaceVersion,
      onPeersChange,
      onWsStatusChange,
    },
    ref,
  ) {
    const ydocRef = useRef<Y.Doc | null>(null)
    const ytextRef = useRef<Y.Text | null>(null)
    const awarenessRef = useRef<Awareness | null>(null)
    const apiRef = useRef<{
      updateScene: (scene: { elements: readonly unknown[]; files?: Record<string, unknown> }) => void
    } | null>(null)
    const applyingRemoteRef = useRef(false)
    const wsSendRef = useRef<(env: EditorWsEnvelope) => boolean>(() => false)
    const sendRef = useRef<(update: Uint8Array) => void>(() => {})
    const sendSnapshotRef = useRef<(full: Uint8Array) => void>(() => {})
    const sendAwarenessRef = useRef<(update: Uint8Array) => void>(() => {})
    const pendingEnvelopesRef = useRef<EditorWsEnvelope[]>([])
    const sessionSyncTimer = useRef<number | null>(null)
    const workspaceVersionRef = useRef(workspaceVersion ?? 1)

    const [initialScene, setInitialScene] = useState<ScenePayload>({ elements: [], files: {} })
    const [ready, setReady] = useState(false)

    workspaceVersionRef.current = workspaceVersion ?? workspaceVersionRef.current

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
      getSceneJSON: () => ytextRef.current?.toString() ?? '',
      reconnect,
    }))

    useEffect(() => {
      if (!token) return

      const ydoc = new Y.Doc()
      ydocRef.current = ydoc
      const ytext = ydoc.getText('scene')
      ytextRef.current = ytext
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

      const emitPeers = () => onPeersChange?.(peersFromAwareness(awareness))
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

      const pushSceneToExcalidraw = (raw: string) => {
        const scene = parseScene(raw)
        setInitialScene(scene)
        if (apiRef.current) {
          applyingRemoteRef.current = true
          try {
            apiRef.current.updateScene({
              elements: scene.elements,
              files: scene.files,
            })
          } finally {
            window.setTimeout(() => {
              applyingRemoteRef.current = false
            }, 0)
          }
        }
      }

      const scheduleSessionSync = (raw: string) => {
        if (!sessionTaskId) return
        if (sessionSyncTimer.current) window.clearTimeout(sessionSyncTimer.current)
        sessionSyncTimer.current = window.setTimeout(() => {
          sessionSyncTimer.current = null
          const scene = parseScene(raw)
          void patchSystemDesignWorkspace({
            sessionTaskId,
            expectedVersion: workspaceVersionRef.current,
            diagram: {
              elements: scene.elements,
              files: scene.files ?? {},
            },
          })
            .then((res) => {
              workspaceVersionRef.current = res.workspace.version
            })
            .catch(() => {
              /* best-effort sync from collab tab */
            })
        }, 1200)
      }

      const seedFromSessionWorkspace = async () => {
        if (!sessionTaskId || ytext.length > 0) return
        try {
          const res = await getSystemDesignWorkspace(sessionTaskId)
          workspaceVersionRef.current = res.workspace.version
          const diagram = res.workspace.diagram
          if (!diagram || !Array.isArray(diagram.elements)) return
          const payload = JSON.stringify({
            elements: diagram.elements,
            files: diagram.files && typeof diagram.files === 'object' ? diagram.files : {},
          })
          ydoc.transact(() => {
            ytext.insert(0, payload)
          })
        } catch {
          /* empty collab doc is fine */
        }
      }

      const onYText = () => {
        const raw = ytext.toString()
        pushSceneToExcalidraw(raw)
        scheduleSessionSync(raw)
      }
      ytext.observe(onYText)

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

      if (ytext.length > 0) {
        pushSceneToExcalidraw(ytext.toString())
      } else {
        void seedFromSessionWorkspace()
      }
      setReady(true)
      flushPendingEnvelopes()

      return () => {
        pendingEnvelopesRef.current = []
        try {
          sendFullSnapshot()
        } catch {
          /* ignore */
        }
        if (sessionSyncTimer.current) window.clearTimeout(sessionSyncTimer.current)
        document.removeEventListener('visibilitychange', onTabActivity)
        window.removeEventListener('focus', onTabActivity)
        window.removeEventListener('blur', onTabActivity)
        awareness.off('change', emitPeers)
        awareness.setLocalState(null)
        if (snapshotTimer !== null) window.clearTimeout(snapshotTimer)
        ytext.unobserve(onYText)
        ydoc.off('update', onYUpdate)
        awareness.off('update', onAwUpdate)
        awareness.destroy()
        ydoc.destroy()
        ydocRef.current = null
        ytextRef.current = null
        awarenessRef.current = null
        apiRef.current = null
        setReady(false)
      }
    }, [roomId, token, displayName, userId, sessionTaskId, flushPendingEnvelopes])

    const handleChange = useCallback(
      (elements: readonly unknown[], _appState: unknown, files: unknown) => {
        if (frozen || applyingRemoteRef.current) return
        const ytext = ytextRef.current
        const ydoc = ydocRef.current
        if (!ytext || !ydoc) return
        const payload = JSON.stringify({
          elements: [...elements],
          files: (files as Record<string, unknown>) ?? {},
        })
        if (ytext.toString() === payload) return
        ydoc.transact(() => {
          ytext.delete(0, ytext.length)
          ytext.insert(0, payload)
        })
      },
      [frozen],
    )

    if (!token) {
      return <div className="grid h-full place-items-center text-sm text-text-muted">No token</div>
    }

    return (
      <div className="hone-excalidraw-mount-web h-full w-full">
        {ready ? (
          <Excalidraw
            initialData={{
              elements: initialScene.elements as never[],
              files: initialScene.files as never,
            }}
            onChange={handleChange}
            viewModeEnabled={frozen}
            excalidrawAPI={(api) => {
              apiRef.current = api as typeof apiRef.current
            }}
            UIOptions={{ canvasActions: { loadScene: false, export: false } }}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-text-muted">Connecting…</div>
        )}
      </div>
    )
  },
)
