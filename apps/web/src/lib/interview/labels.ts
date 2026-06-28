/** Strip protobuf-style enum prefix for UI labels. */
export function formatEnumLabel(value: string, prefix: string): string {
  if (!value.startsWith(prefix)) return value.replace(/_/g, ' ').toLowerCase()
  return value
    .slice(prefix.length)
    .toLowerCase()
    .replace(/_/g, ' ')
}

export function formatSessionMode(mode: string): string {
  return formatEnumLabel(mode, 'SESSION_MODE_')
}

export function formatSessionStatus(status: string): string {
  return formatEnumLabel(status, 'SESSION_STATUS_')
}

export function formatSectionStatus(status: string): string {
  return formatEnumLabel(status, 'SECTION_STATUS_')
}
