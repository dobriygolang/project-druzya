import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { PublicPageShell } from '@/components/brand/PublicNav'
import { brand } from '@/lib/brand/tokens'
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
    document.documentElement.classList.add('light')
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
      <header className="border-b px-6 py-5 sm:px-8" style={{ borderColor: brand.hair }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Logo to="/welcome" />
          <div className="flex items-center gap-3">
            <LocaleSwitcher compact />
            <Link to="/welcome" className="text-[13.5px] text-text-secondary no-underline">
              {t('public.back')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 pb-16 pt-20 sm:px-8 sm:pt-24">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">{t('login.title')}</h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-text-secondary">{t('login.subtitle')}</p>

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
              <label htmlFor="tg-code" className="block text-sm font-medium">
                {t('login.telegram')}
              </label>
              <p className="mt-1 text-xs text-text-secondary">
                {t('login.telegramHintOpen')}{' '}
                <a
                  href={`https://t.me/${botLinkName}?start=login`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-primary underline"
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
                className="mono mt-2 w-full rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm outline-none focus:border-border-strong"
                autoComplete="one-time-code"
                maxLength={16}
              />
            </div>
            <Button type="submit" className="w-full" loading={busy}>
              {hasCode ? t('login.submitTelegram') : t('login.openTelegramBot')}
            </Button>
          </form>

          <div className="relative my-5 text-center">
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <span className="relative bg-bg px-3 text-[13px] text-text-secondary">{t('common.or')}</span>
          </div>

          <Button variant="ghost" className="w-full" loading={busy} onClick={() => void onYandex()}>
            {t('login.submitYandex')}
          </Button>

          <p className="mt-8 text-center text-xs text-text-secondary">{t('login.autoRegister')}</p>
        </div>
      </main>
    </PublicPageShell>
  )
}
