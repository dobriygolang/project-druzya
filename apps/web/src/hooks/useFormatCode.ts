import { useCallback, useState } from 'react'
import { formatApiError } from '@/lib/apiClient'
import { formatCode } from '@/lib/api/sandbox'
import { normalizeEditorLang } from '@/lib/codemirror/langExtension'

export function useFormatCode() {
  const [formatting, setFormatting] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)

  const format = useCallback(async (language: string, code: string) => {
    if (!code.trim()) return null
    if (normalizeEditorLang(language) !== 'go') {
      setFormatError('Форматирование доступно только для Go')
      return null
    }
    setFormatting(true)
    setFormatError(null)
    try {
      const res = await formatCode({ language, code })
      return res.code
    } catch (err) {
      setFormatError(formatApiError(err))
      return null
    } finally {
      setFormatting(false)
    }
  }, [])

  return { format, formatting, formatError, clearFormatError: () => setFormatError(null) }
}
