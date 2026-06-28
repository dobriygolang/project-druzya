const KEY = 'druzya_guest_display_name'

export function readGuestDisplayName(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function persistGuestDisplayName(name: string): void {
  try {
    localStorage.setItem(KEY, name.trim())
  } catch {
    /* noop */
  }
}
