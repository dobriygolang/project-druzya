import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import {
  EXCALIDRAW_MOUNT_CLASS,
  EXCALIDRAW_THEME,
  EXCALIDRAW_UI_OPTIONS,
  excalidrawSiteAppState,
} from '@/components/system-design/excalidrawTheme'
import { collabUserColors } from '@/lib/codemirror/collabColors'
import { peersFromAwareness, type CollabPeer } from '@/lib/codemirror/collabPresence'
import {
  migrateLegacySceneText,
  observeSceneChanges,
  readSceneFromYjs,
  sceneHasContent,
  sceneToJSON,
  writeSceneToYjs,
  type ScenePayload,
} from '@/lib/collab/excalidrawYjsDoc'
import { getSystemDesignWorkspace, patchSystemDesignWorkspace } from '@/lib/api/systemDesign'
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
    const awarenessRef = useRef<Awareness | null>(null)
    const apiRef = useRef<{
      updateScene: (scene: { elements: readonly unknown[]; files?: Record<string, unknown> }) => void
    } | null>(null)
    const applyingRemoteRef = useRef(false)
    const remoteApplyTimerRef = useRef<number | null>(null)
    const wsSendRef = useRef<(env: EditorWsEnvelope) => boolean>(() => false)
    const sendRef = useRef<(update: Uint8Array) => void>(() => {})
    const sendSnapshotRef = useRef<(full: Uint8Array) => void>(() => {})
    const sendAwarenessRef = useRef<(update: Uint8Array) => void>(() => {})
    const pendingEnvelopesRef = useRef<EditorWsEnvelope[]>([])
    const sessionSyncTimer = useRef<number | null>(null)
    const workspaceVersionRef = useRef(workspaceVersion ?? 1)
    const pendingLocalRef = useRef<ScenePayload | null>(null)
    const localRafRef = useRef(0)

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
      getSceneJSON: () => (ydocRef.current ? sceneToJSON(ydocRef.current) : ''),
      reconnect,
    }))

    const flushLocalToYjs = useCallback(() => {
      const pending = pendingLocalRef.current
      const ydoc = ydocRef.current
      if (!pending || !ydoc) return
      pendingLocalRef.current = null
      writeSceneToYjs(ydoc, pending.elements, pending.files, 'local')
    }, [])

    const pushSceneToExcalidraw = useCallback((scene: ScenePayload) => {
      setInitialScene(scene)
      if (!apiRef.current) return

      if (remoteApplyTimerRef.current) window.clearTimeout(remoteApplyTimerRef.current)
      applyingRemoteRef.current = true
      try {
        apiRef.current.updateScene({
          elements: scene.elements,
          files: scene.files,
        })
      } finally {
        // Excalidraw may emit onChange after updateScene — hold the guard briefly.
        remoteApplyTimerRef.current = window.setTimeout(() => {
          applyingRemoteRef.current = false
          remoteApplyTimerRef.current = null
        }, 100)
      }
    }, [])

    useEffect(() => {
      if (!token) return

      const ydoc = new Y.Doc()
      ydocRef.current = ydoc
      const awareness = new Awareness(ydoc)
      awarenessRef.current = awareness

      migrateLegacySceneText(ydoc)

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

      const scheduleSessionSync = () => {
        if (!sessionTaskId) return
        if (sessionSyncTimer.current) window.clearTimeout(sessionSyncTimer.current)
        sessionSyncTimer.current = window.setTimeout(() => {
          sessionSyncTimer.current = null
          const scene = readSceneFromYjs(ydoc)
          void patchSystemDesignWorkspace({
            sessionTaskId,
            expectedVersion: workspaceVersionRef.current,
            diagram: {
              elements: scene.elements,
              files: scene.files,
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
        if (!sessionTaskId || sceneHasContent(ydoc)) return
        try {
          const res = await getSystemDesignWorkspace(sessionTaskId)
          workspaceVersionRef.current = res.workspace.version
          const diagram = res.workspace.diagram
          if (!diagram || !Array.isArray(diagram.elements)) return
          writeSceneToYjs(
            ydoc,
            diagram.elements,
            diagram.files && typeof diagram.files === 'object'
              ? (diagram.files as Record<string, unknown>)
              : {},
            'seed',
          )
        } catch {
          /* empty collab doc is fine */
        }
      }

      const stopObserving = observeSceneChanges(ydoc, (scene) => {
        pushSceneToExcalidraw(scene)
        scheduleSessionSync()
      })

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

      setInitialScene(readSceneFromYjs(ydoc))
      if (!sceneHasContent(ydoc)) {
        void seedFromSessionWorkspace()
      }
      setReady(true)
      flushPendingEnvelopes()

      return () => {
        pendingEnvelopesRef.current = []
        if (localRafRef.current) cancelAnimationFrame(localRafRef.current)
        if (remoteApplyTimerRef.current) window.clearTimeout(remoteApplyTimerRef.current)
        try {
          sendFullSnapshot()
        } catch {
          /* ignore */
        }
        if (sessionSyncTimer.current) window.clearTimeout(sessionSyncTimer.current)
        stopObserving()
        document.removeEventListener('visibilitychange', onTabActivity)
        window.removeEventListener('focus', onTabActivity)
        window.removeEventListener('blur', onTabActivity)
        awareness.off('change', emitPeers)
        awareness.setLocalState(null)
        if (snapshotTimer !== null) window.clearTimeout(snapshotTimer)
        ydoc.off('update', onYUpdate)
        awareness.off('update', onAwUpdate)
        awareness.destroy()
        ydoc.destroy()
        ydocRef.current = null
        awarenessRef.current = null
        apiRef.current = null
        pendingLocalRef.current = null
        setReady(false)
      }
    }, [roomId, token, displayName, userId, sessionTaskId, flushPendingEnvelopes, pushSceneToExcalidraw])

    const handleChange = useCallback(
      (elements: readonly unknown[], _appState: unknown, files: unknown) => {
        if (frozen || applyingRemoteRef.current) return
        const ydoc = ydocRef.current
        if (!ydoc) return

        pendingLocalRef.current = {
          elements: [...elements],
          files: (files as Record<string, unknown>) ?? {},
        }
        if (localRafRef.current) return
        localRafRef.current = requestAnimationFrame(() => {
          localRafRef.current = 0
          flushLocalToYjs()
        })
      },
      [frozen, flushLocalToYjs],
    )

    if (!token) {
      return <div className="grid h-full place-items-center text-sm text-text-muted">No token</div>
    }

    return (
      <div className={`${EXCALIDRAW_MOUNT_CLASS} h-full w-full`}>
        {ready ? (
          <Excalidraw
            theme={EXCALIDRAW_THEME}
            initialData={{
              elements: initialScene.elements as never[],
              files: initialScene.files as never,
              appState: excalidrawSiteAppState(),
            }}
            onChange={handleChange}
            viewModeEnabled={frozen}
            excalidrawAPI={(api) => {
              apiRef.current = api as typeof apiRef.current
            }}
            UIOptions={EXCALIDRAW_UI_OPTIONS}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-text-muted">Connecting…</div>
        )}
      </div>
    )
  },
)
