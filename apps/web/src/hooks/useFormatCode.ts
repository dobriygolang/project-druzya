import { useCallback, useState } from 'react'
import { ApiError, formatApiError } from '@/lib/apiClient'
import { formatCode } from '@/lib/api/sandbox'
import { normalizeEditorLang } from '@/lib/codemirror/langExtension'
import { useI18n } from '@/lib/i18n'

export function useFormatCode(accessToken?: string | null) {
  const { t } = useI18n()
  const [formatting, setFormatting] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)

  const format = useCallback(
    async (language: string, code: string) => {
      if (!code.trim()) return null
      if (normalizeEditorLang(language) !== 'go') {
        setFormatError(t('session.editorFormatGoOnly'))
        return null
      }
      setFormatting(true)
      setFormatError(null)
      try {
        const res = await formatCode({ language, code }, accessToken)
        return res.code
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setFormatError(t('session.editorFormatAuthExpired'))
        } else {
          setFormatError(formatApiError(err))
        }
        return null
      } finally {
        setFormatting(false)
      }
    },
    [accessToken, t],
  )

  return { format, formatting, formatError, clearFormatError: () => setFormatError(null) }
}
