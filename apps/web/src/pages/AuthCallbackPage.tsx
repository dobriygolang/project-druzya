import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PublicNav, PublicPageShell } from '@/components/brand/PublicNav'
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
        const next = sessionStorage.getItem('oauth_next') ?? '/profile'
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
    <PublicPageShell>
      <PublicNav />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          {error ? (
            <>
              <h1 className="text-xl font-semibold text-site-text">Не удалось войти</h1>
              <p className="mt-2 text-sm text-site-muted">{error}</p>
              <Link to="/login" className="mt-4 inline-block text-sm text-site-text underline">
                Вернуться к входу
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-site-muted/30 border-t-site-text" />
              <p className="mt-4 text-sm text-site-muted">Завершаем вход через Yandex…</p>
            </>
          )}
        </div>
      </main>
    </PublicPageShell>
  )
}
