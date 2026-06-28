import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
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
        const next = sessionStorage.getItem('oauth_next') ?? '/today'
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
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <header className="flex items-center justify-between border-b border-border px-6 py-5 sm:px-8">
        <Logo to="/welcome" size="sm" />
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          {error ? (
            <>
              <h1 className="text-xl font-semibold">Не удалось войти</h1>
              <p className="mt-2 text-sm text-text-muted">{error}</p>
              <Link to="/login" className="mt-4 inline-block text-sm underline">
                Вернуться к входу
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-text-primary/20 border-t-text-primary" />
              <p className="mt-4 text-sm text-text-muted">Завершаем вход через Yandex…</p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
