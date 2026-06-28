import { LSPClient, languageServerExtensions, serverCompletion } from '@codemirror/lsp-client'
import type { Extension } from '@codemirror/state'
import { connectGoLspWithAuth } from './goLspTransport'

const LSP_TIMEOUT_MS = 15_000

export async function createGoLspExtension(): Promise<{
  extension: Extension
  dispose: () => void
} | null> {
  const session = await connectGoLspWithAuth()
  if (!session) return null

  const client = new LSPClient({
    rootUri: session.rootUri,
    timeout: LSP_TIMEOUT_MS,
    extensions: [
      ...languageServerExtensions(),
      serverCompletion({ override: true }),
    ],
  }).connect(session.transport)

  await client.initializing

  const dispose = () => {
    client.disconnect()
    session.close()
  }

  return {
    extension: client.plugin(session.docUri, 'go'),
    dispose,
  }
}
