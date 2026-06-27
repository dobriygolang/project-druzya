import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authTelegram, getYandexAuthURL } from '@/lib/api/auth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? 'your_bot'

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onTelegramSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await authTelegram(code)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setBusy(false)
    }
  }

  async function onYandex() {
    setError(null)
    setBusy(true)
    try {
      const { url, state } = await getYandexAuthURL()
      sessionStorage.setItem('oauth_state_yandex', state)
      sessionStorage.setItem('oauth_next', next)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка Yandex OAuth')
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card elevation="e2" padding="lg" className="w-full max-w-md shadow-card">
        <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
        <p className="mt-2 text-sm text-text-muted">
          Подготовка к техническим собеседованиям: mock-интервью, тренировки и персональный план.
        </p>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <form onSubmit={(e) => void onTelegramSubmit(e)} className="mt-8 space-y-4">
          <div>
            <label htmlFor="tg-code" className="block text-sm font-medium">
              Telegram
            </label>
            <p className="mt-1 text-xs text-text-muted">
              Открой{' '}
              <a
                href={`https://t.me/${BOT_USERNAME}?start=login`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                @{BOT_USERNAME}
              </a>
              , отправь /start login и введи код из бота.
            </p>
            <input
              id="tg-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              className="mono mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-border-strong"
              autoComplete="one-time-code"
              maxLength={16}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            loading={busy}
            disabled={code.trim().length < 4}
          >
            Войти через Telegram
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-text-muted">
          <div className="h-px flex-1 bg-border" />
          или
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="ghost" className="w-full" loading={busy} onClick={() => void onYandex()}>
          Войти через Yandex
        </Button>

        <p className="mt-6 text-center text-xs text-text-muted">
          Нет аккаунта? Регистрация происходит автоматически при первом входе.
        </p>
        <p className="mt-2 text-center text-xs">
          <Link to="/dashboard" className="text-text-muted underline">
            На главную
          </Link>
        </p>
      </Card>
    </div>
  )
}
