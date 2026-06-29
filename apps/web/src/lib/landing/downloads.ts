const MAC_URL = import.meta.env.VITE_HONE_DOWNLOAD_MAC ?? ''
const WIN_URL = import.meta.env.VITE_HONE_DOWNLOAD_WIN ?? ''

export type DownloadPlatform = 'mac' | 'windows' | 'other'

export function detectPlatform(): DownloadPlatform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() ?? ''
  if (/mac|iphone|ipad|ipod/.test(platform) || /mac os/.test(ua)) return 'mac'
  if (/win/.test(platform) || /windows/.test(ua)) return 'windows'
  return 'other'
}

export function downloadUrlFor(platform: DownloadPlatform): string | null {
  if (platform === 'mac' && MAC_URL) return MAC_URL
  if (platform === 'windows' && WIN_URL) return WIN_URL
  return null
}

export function hasAnyDownloadUrl(): boolean {
  return Boolean(MAC_URL || WIN_URL)
}
