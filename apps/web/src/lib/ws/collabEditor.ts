import { useCallback, useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { applyAwarenessUpdate } from 'y-protocols/awareness'
import type { Awareness } from 'y-protocols/awareness'

export type EditorWsEnvelope = {
  kind: string
  data?: unknown
}

export type EditorWsStatus = 'connecting' | 'open' | 'reconnecting' | 'failed' | 'closed'

export function decodeYjsPayload(payload: unknown): Uint8Array | null {
  if (payload == null) return null
  if (typeof payload === 'string') return b64ToBytes(payload)
  if (payload instanceof Uint8Array) return payload
  if (Array.isArray(payload)) return new Uint8Array(payload as number[])
  return null
}

export function useEditorWs(
  roomId: string | undefined,
  token: string | undefined,
  onEnvelope?: (env: EditorWsEnvelope) => void,
) {
  const [status, setStatus] = useState<EditorWsStatus>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const closedByUser = useRef(false)
  const [reconnectKey, setReconnectKey] = useState(0)
  const onEnvelopeRef = useRef(onEnvelope)
  onEnvelopeRef.current = onEnvelope

  useEffect(() => {
    if (!roomId || !token) {
      setStatus('closed')
      return
    }
    closedByUser.current = false
    attemptsRef.current = 0

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const base =
      (import.meta.env.VITE_WS_BASE as string | undefined) || `${proto}//${window.location.host}/ws`
    const url = `${base.replace(/\/$/, '')}/editor/${encodeURIComponent(roomId)}?token=${encodeURIComponent(token)}`

    const connect = () => {
      setStatus(attemptsRef.current === 0 ? 'connecting' : 'reconnecting')
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => {
        attemptsRef.current = 0
        setStatus('open')
      }
      ws.onmessage = (ev) => {
        try {
          const env = JSON.parse(ev.data) as EditorWsEnvelope
          onEnvelopeRef.current?.(env)
        } catch {
          /* ignore */
        }
      }
      ws.onerror = () => {
        /* onclose handles retry */
      }
      ws.onclose = () => {
        if (closedByUser.current) {
          setStatus('closed')
          return
        }
        attemptsRef.current += 1
        if (attemptsRef.current > 5) {
          setStatus('failed')
          return
        }
        const backoff = Math.min(10_000, 500 * 2 ** attemptsRef.current)
        timerRef.current = window.setTimeout(connect, backoff)
      }
    }

    connect()

    return () => {
      closedByUser.current = true
      if (timerRef.current) window.clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [roomId, token, reconnectKey])

  const send = useCallback((env: EditorWsEnvelope) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(env))
    return true
  }, [])

  const reconnect = useCallback(() => {
    attemptsRef.current = 0
    setReconnectKey((n) => n + 1)
  }, [])

  return { status, send, reconnect }
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function applyWsEnvelope(
  env: EditorWsEnvelope,
  ydoc: Y.Doc,
  awareness: Awareness | null,
): void {
  if (env.kind === 'snapshot' || env.kind === 'op') {
    const data = env.data as { payload?: unknown } | undefined
    const bytes = decodeYjsPayload(data?.payload)
    if (bytes && bytes.byteLength > 0) {
      Y.applyUpdate(ydoc, bytes, 'remote')
    }
    return
  }

  if (env.kind === 'presence' && awareness) {
    const data = env.data as { data?: { update?: string }; update?: string } | undefined
    const b64 = data?.data?.update ?? data?.update
    if (typeof b64 === 'string') {
      try {
        applyAwarenessUpdate(awareness, b64ToBytes(b64), 'remote')
      } catch {
        /* ignore */
      }
    }
  }
}
