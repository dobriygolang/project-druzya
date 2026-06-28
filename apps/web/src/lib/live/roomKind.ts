import type { CodeRoom } from '@/lib/api/rooms'

export function isDesignRoom(room: Pick<CodeRoom, 'room_type'>): boolean {
  return room.room_type === 'system_design'
}

export function isCodeRoom(room: Pick<CodeRoom, 'room_type'>): boolean {
  return room.room_type !== 'system_design'
}
