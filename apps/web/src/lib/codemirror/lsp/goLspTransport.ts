import type { Transport } from '@codemirror/lsp-client'
import { readAccessToken } from '@/lib/apiClient'

export type LspSessionConfig = {
  rootUri: string
  docUri: string
  transport: Transport
  close: () => void
}

type ConfigMessage = {
  type: 'config'
  rootUri: string
  docUri: string
}

export function goLspEnabled(): boolean {
  return import.meta.env.VITE_GO_LSP !== 'false'
}

export function goLspWebSocketUrl(token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const base =
    (import.meta.env.VITE_WS_BASE as string | undefined) || `${proto}//${window.location.host}/ws`
  return `${base.replace(/\/$/, '')}/lsp/go?token=${encodeURIComponent(token)}`
}

/** Connect to sandbox gopls proxy; first frame is session config, then raw LSP JSON. */
export function connectGoLspTransport(token: string): Promise<LspSessionConfig> {
  return new Promise((resolve, reject) => {
    const handlers: Array<(value: string) => void> = []
    let settled = false
    const sock = new WebSocket(goLspWebSocketUrl(token))

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      try {
        sock.close()
      } catch {
        /* noop */
      }
      reject(err)
    }

    sock.onerror = () => fail(new Error('LSP WebSocket connection failed'))
    sock.onclose = () => {
      if (!settled) fail(new Error('LSP WebSocket closed before ready'))
    }
    sock.onmessage = (ev) => {
      const data = ev.data.toString()
      if (!settled) {
        try {
          const msg = JSON.parse(data) as ConfigMessage
          if (msg.type !== 'config' || !msg.docUri || !msg.rootUri) {
            fail(new Error('invalid LSP session config'))
            return
          }
          settled = true
          resolve({
            rootUri: msg.rootUri,
            docUri: msg.docUri,
            transport: {
              send(message: string) {
                if (sock.readyState === WebSocket.OPEN) sock.send(message)
              },
              subscribe(handler: (value: string) => void) {
                handlers.push(handler)
              },
              unsubscribe(handler: (value: string) => void) {
                const i = handlers.indexOf(handler)
                if (i >= 0) handlers.splice(i, 1)
              },
            },
            close() {
              handlers.length = 0
              if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) {
                sock.close()
              }
            },
          })
        } catch {
          fail(new Error('invalid LSP session config'))
        }
        return
      }
      for (const h of handlers) h(data)
    }
  })
}

export async function connectGoLspWithAuth(): Promise<LspSessionConfig | null> {
  const token = readAccessToken()
  if (!token) return null
  try {
    return await connectGoLspTransport(token)
  } catch (err) {
    console.warn('[lsp] connect failed', err)
    return null
  }
}
