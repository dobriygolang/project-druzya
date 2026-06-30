import { useEffect } from 'react'
import { RouteLoader } from '@/components/RouteLoader'
import { detectPlatform, HONE_RELEASES_PAGE, resolveDownloadUrl } from '@/lib/landing/downloads'

/** Shareable link: druz9.online/download → latest installer for this OS. */
export default function HoneDownloadPage() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const url = await resolveDownloadUrl(detectPlatform())
      if (cancelled) return
      window.location.replace(url ?? HONE_RELEASES_PAGE)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return <RouteLoader />
}
