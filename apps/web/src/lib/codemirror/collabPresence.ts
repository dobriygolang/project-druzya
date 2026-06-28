import type { Awareness } from 'y-protocols/awareness'

export type CollabPeer = {
  clientId: number
  userId: string
  name: string
  color: string
  isSelf: boolean
  /** Tab visible and window focused. */
  active: boolean
}

type AwarenessUser = {
  name?: string
  color?: string
  colorLight?: string
  userId?: string
  active?: boolean
}

export function peersFromAwareness(awareness: Awareness): CollabPeer[] {
  const selfId = awareness.clientID
  const peers: CollabPeer[] = []
  awareness.getStates().forEach((state, clientId) => {
    const user = state.user as AwarenessUser | undefined
    if (!user?.name) return
    peers.push({
      clientId,
      userId: user.userId ?? String(clientId),
      name: user.name,
      color: user.color ?? '#30bced',
      isSelf: clientId === selfId,
      active: user.active !== false,
    })
  })
  peers.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return peers
}
