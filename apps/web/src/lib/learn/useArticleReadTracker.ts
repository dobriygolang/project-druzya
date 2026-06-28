import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markArticleRead } from '@/lib/api/recommendation'

/** Marks article read after user scrolls past threshold (once). */
export function useArticleReadTracker(slug: string, enabled: boolean) {
  const qc = useQueryClient()
  const markedRef = useRef(false)

  const markM = useMutation({
    mutationFn: () => markArticleRead(slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  useEffect(() => {
    if (!enabled || !slug || markedRef.current) return

    function onScroll() {
      if (markedRef.current) return
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      if (scrollable <= 0) return
      const progress = window.scrollY / scrollable
      if (progress >= 0.72) {
        markedRef.current = true
        markM.mutate()
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate once per slug mount
  }, [enabled, slug])

  return {
    markingRead: markM.isPending,
    markedRead: markedRef.current || markM.isSuccess,
  }
}
