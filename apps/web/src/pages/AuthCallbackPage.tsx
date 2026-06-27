import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeYandexCode } from '@/lib/api/auth'

export default function AuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const exchangeCode = params.get('code')
    const errParam = params.get('error')
    if (errParam) {
      setError(`Yandex отклонил авторизацию: ${errParam}`)
      return
    }
    if (!exchangeCode) {
      setError('Нет exchange code в URL')
      return
    }

    let cancelled = false
    void (async () => {
      try {
        await exchangeYandexCode(exchangeCode)
        if (cancelled) return
        const next = sessionStorage.getItem('oauth_next') ?? '/dashboard'
        sessionStorage.removeItem('oauth_next')
        sessionStorage.removeItem('oauth_state_yandex')
        navigate(next, { replace: true })
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Ошибка обмена кода')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [params, navigate])

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Не удалось войти</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <Link to="/login" className="mt-4 inline-block text-sm underline">
              Вернуться к входу
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
            <p className="mt-4 text-sm text-muted">Завершаем вход через Yandex…</p>
          </>
        )}
      </div>
    </div>
  )
}
