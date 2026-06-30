import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PublicPageShell } from '@/components/brand/PublicNav'
import { authTelegram, getAuthConfig, getYandexAuthURL } from '@/lib/api/auth'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'

const DEFAULT_BOT = import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? ''

export default function LoginPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/profile'
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [botUsername, setBotUsername] = useState(DEFAULT_BOT)

  useEffect(() => {
    getAuthConfig()
      .then((cfg) => {
        if (cfg.telegram_bot_username) setBotUsername(cfg.telegram_bot_username)
      })
      .catch(() => {})
  }, [])

  const botLinkName = botUsername || 'your_bot'
  const botUrl = `https://t.me/${botLinkName}?start=login`
  const trimmedCode = code.trim()
  const hasCode = trimmedCode.length > 0

  async function onTelegramSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasCode) {
      window.location.href = botUrl
      return
    }
    setError(null)
    setBusy(true)
    try {
      await authTelegram(trimmedCode)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loginError'))
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
      setError(err instanceof Error ? err.message : t('login.yandexError'))
      setBusy(false)
    }
  }

  return (
    <PublicPageShell>
      <main className="mx-auto flex max-w-7xl flex-1 justify-center px-6 pb-16 pt-12 sm:px-8 sm:pt-16">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-site-text">{t('login.title')}</h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-site-muted">{t('login.subtitle')}</p>

          {error ? (
            <div
              role="alert"
              className="mb-5 mt-6 rounded-[10px] border border-danger/35 bg-danger/[0.04] px-3.5 py-3 text-[13px] text-[#B5251D]"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={(e) => void onTelegramSubmit(e)} className="mt-8 space-y-4">
            <div>
              <label htmlFor="tg-code" className="block text-sm font-medium text-site-text">
                {t('login.telegram')}
              </label>
              <p className="mt-1 text-xs text-site-muted">
                {t('login.telegramHintOpen')}{' '}
                <a
                  href={`https://t.me/${botLinkName}?start=login`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-site-text underline"
                >
                  @{botLinkName}
                </a>
                {t('login.telegramHintAfter')}
              </p>
              <input
                id="tg-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD1234"
                className="mono mt-2 w-full rounded-xl border border-site-border bg-site-bg px-3 py-2.5 text-sm text-site-text outline-none focus:border-site-muted"
                autoComplete="one-time-code"
                maxLength={16}
              />
            </div>
            <Button type="submit" className="w-full" loading={busy}>
              {hasCode ? t('login.submitTelegram') : t('login.openTelegramBot')}
            </Button>
          </form>

          <div className="relative my-5 text-center">
            <span className="absolute inset-x-0 top-1/2 h-px bg-site-border" />
            <span className="relative bg-site-bg px-3 text-[13px] text-site-muted">{t('common.or')}</span>
          </div>

          <Button variant="ghost" className="w-full" loading={busy} onClick={() => void onYandex()}>
            {t('login.submitYandex')}
          </Button>

          <p className="mt-8 text-center text-xs text-site-muted">{t('login.autoRegister')}</p>
        </div>
      </main>
    </PublicPageShell>
  )
}
