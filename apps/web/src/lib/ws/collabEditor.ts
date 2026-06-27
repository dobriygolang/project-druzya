import { useEffect, useRef, useState } from 'react'

export type EditorWsEnvelope = {
  kind: string
  data?: unknown
}

export type EditorWsStatus = 'connecting' | 'open' | 'reconnecting' | 'failed' | 'closed'

export function useEditorWs(roomId: string | undefined, token: string | undefined) {
  const [status, setStatus] = useState<EditorWsStatus>('connecting')
  const [lastMessage, setLastMessage] = useState<EditorWsEnvelope | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const closedByUser = useRef(false)
  const [reconnectKey, setReconnectKey] = useState(0)

  useEffect(() => {
    if (!roomId || !token) return
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
          setLastMessage(env)
        } catch {
          /* ignore */
        }
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

  const send = (env: EditorWsEnvelope) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(env))
    return true
  }

  const reconnect = () => {
    attemptsRef.current = 0
    setReconnectKey((n) => n + 1)
  }

  return { status, lastMessage, send, reconnect }
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
