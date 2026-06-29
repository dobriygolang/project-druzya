import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { detectPlatform, downloadUrlFor } from '@/lib/landing/downloads'
import { useI18n } from '@/lib/i18n'

type LandingDownloadContextValue = {
  preparing: boolean
  downloaded: boolean
  label: string
  onDownload: () => void
}

const LandingDownloadContext = createContext<LandingDownloadContextValue | null>(null)

export function LandingDownloadProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const platform = useMemo(() => detectPlatform(), [])
  const downloadUrl = downloadUrlFor(platform)
  const [downloaded, setDownloaded] = useState(false)
  const preparing = !downloadUrl

  const label = downloaded
    ? t('welcome.downloadStarted')
    : preparing
      ? t('welcome.preparingDownload')
      : t('welcome.downloadCta')

  const onDownload = useCallback(() => {
    if (!downloadUrl) return
    window.open(downloadUrl, '_blank', 'noopener,noreferrer')
    setDownloaded(true)
  }, [downloadUrl])

  const value = useMemo(
    () => ({ preparing, downloaded, label, onDownload }),
    [preparing, downloaded, label, onDownload],
  )

  return <LandingDownloadContext.Provider value={value}>{children}</LandingDownloadContext.Provider>
}

export function useLandingDownload() {
  const ctx = useContext(LandingDownloadContext)
  if (!ctx) throw new Error('useLandingDownload must be used within LandingDownloadProvider')
  return ctx
}
