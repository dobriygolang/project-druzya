import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { detectPlatform, HONE_RELEASES_PAGE, resolveDownloadUrl } from '@/lib/landing/downloads'
import { fetchLatestHoneRelease } from '@/lib/landing/honeRelease'
import { useI18n } from '@/lib/i18n'

type LandingDownloadContextValue = {
  preparing: boolean
  downloaded: boolean
  label: string
  version: string | null
  releasePageUrl: string
  onDownload: () => void
}

const LandingDownloadContext = createContext<LandingDownloadContextValue | null>(null)

export function LandingDownloadProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const platform = useMemo(() => detectPlatform(), [])
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [releasePageUrl, setReleasePageUrl] = useState(HONE_RELEASES_PAGE)
  const [downloaded, setDownloaded] = useState(false)
  const preparing = !downloadUrl

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [url, release] = await Promise.all([
        resolveDownloadUrl(platform),
        fetchLatestHoneRelease(),
      ])
      if (cancelled) return
      setDownloadUrl(url ?? release?.releasePageUrl ?? HONE_RELEASES_PAGE)
      setVersion(release?.version ?? null)
      if (release?.releasePageUrl) setReleasePageUrl(release.releasePageUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [platform])

  const label = downloaded
    ? t('welcome.downloadStarted')
    : preparing
      ? t('welcome.preparingDownload')
      : version
        ? t('welcome.downloadCtaVersion', { version })
        : t('welcome.downloadCta')

  const onDownload = useCallback(() => {
    if (!downloadUrl) return
    window.open(downloadUrl, '_blank', 'noopener,noreferrer')
    setDownloaded(true)
  }, [downloadUrl])

  const value = useMemo(
    () => ({ preparing, downloaded, label, version, releasePageUrl, onDownload }),
    [preparing, downloaded, label, version, releasePageUrl, onDownload],
  )

  return <LandingDownloadContext.Provider value={value}>{children}</LandingDownloadContext.Provider>
}

export function useLandingDownload() {
  const ctx = useContext(LandingDownloadContext)
  if (!ctx) throw new Error('useLandingDownload must be used within LandingDownloadProvider')
  return ctx
}
