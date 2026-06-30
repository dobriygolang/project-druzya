import {
  detectMacArch,
  fetchLatestHoneRelease,
  HONE_RELEASES_PAGE,
  type HoneReleaseInfo,
} from '@/lib/landing/honeRelease'

const MAC_URL = import.meta.env.VITE_HONE_DOWNLOAD_MAC ?? ''
const WIN_URL = import.meta.env.VITE_HONE_DOWNLOAD_WIN ?? ''

export type DownloadPlatform = 'mac' | 'windows' | 'other'

export { HONE_RELEASES_PAGE }

export function detectPlatform(): DownloadPlatform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() ?? ''
  if (/mac|iphone|ipad|ipod/.test(platform) || /mac os/.test(ua)) return 'mac'
  if (/win/.test(platform) || /windows/.test(ua)) return 'windows'
  return 'other'
}

async function urlFromRelease(
  release: HoneReleaseInfo,
  platform: DownloadPlatform,
): Promise<string | null> {
  if (platform === 'windows') return release.windowsUrl
  if (platform === 'mac') {
    const arch = await detectMacArch()
    if (arch === 'x64') return release.macX64Url ?? release.macAarch64Url
    return release.macAarch64Url ?? release.macX64Url
  }
  return release.macAarch64Url ?? release.windowsUrl ?? release.macX64Url
}

function urlFromEnv(platform: DownloadPlatform): string | null {
  if (platform === 'mac' && MAC_URL) return MAC_URL
  if (platform === 'windows' && WIN_URL) return WIN_URL
  return null
}

export async function resolveDownloadUrl(platform: DownloadPlatform): Promise<string | null> {
  const envUrl = urlFromEnv(platform)
  if (envUrl) return envUrl

  const release = await fetchLatestHoneRelease()
  if (!release) return null

  const direct = await urlFromRelease(release, platform)
  if (direct) return direct

  if (platform === 'other') {
    return release.macAarch64Url ?? release.windowsUrl ?? release.macX64Url
  }

  return release.releasePageUrl
}

export function hasStaticDownloadUrl(): boolean {
  return Boolean(MAC_URL || WIN_URL)
}
