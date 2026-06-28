import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Logo } from '@/components/brand/Logo'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { getMe } from '@/lib/api/auth'
import { formatApiError, readAccessToken } from '@/lib/apiClient'
import { LIVE_LANGS } from '@/lib/live/constants'
import { readGuestDisplayName, persistGuestDisplayName } from '@/lib/live/guestDisplayName'
import { useCreateLiveRoom } from '@/lib/live/useCreateLiveRoom'

export function LiveNewPage() {
  const authed = !!readAccessToken()
  const [displayName, setDisplayName] = useState(() => readGuestDisplayName())
  const [language, setLanguage] = useState('go')

  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: authed })
  const createM = useCreateLiveRoom()

  useEffect(() => {
    document.documentElement.classList.add('light')
    if (meQ.data?.username && !displayName) {
      setDisplayName(meQ.data.username)
    }
  }, [meQ.data?.username, displayName])

  function handleCreate() {
    if (!authed) persistGuestDisplayName(displayName || 'Guest')
    createM.mutate({
      language,
      displayName: displayName || undefined,
    })
  }

  return (
    <div
      className="min-h-screen bg-bg text-text-primary"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      <header className="border-b px-6 py-5 sm:px-8" style={{ borderColor: brand.hair }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Logo to="/welcome" />
          {authed ? (
            <Link to="/today" className="text-sm text-text-secondary no-underline hover:text-text-primary">
              В приложение
            </Link>
          ) : (
            <Link to="/login?next=/live/new" className="text-sm text-text-secondary no-underline hover:text-text-primary">
              Войти
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-10 px-6 py-16 sm:px-8 lg:flex-row lg:items-start lg:gap-16 lg:py-20">
        <div className="flex-1 lg:max-w-md">
          <Eyebrow>Live coding</Eyebrow>
          <h1 className="mt-3 text-[clamp(2rem,5vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
            Общий редактор в реальном времени
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text-secondary">
            Создай комнату без регистрации — получишь ссылку-приглашение для напарника. Синхронизация
            через Yjs, запуск кода через sandbox.
          </p>
          <ul className="mt-6 space-y-2.5 text-[13px] text-text-secondary">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.dot }} />
              Без аккаунта — гостевой доступ на время сессии
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.green }} />
              Pair programming с курсорами участников
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand.dot }} />
              ⌘↵ Run — проверка кода в sandbox
            </li>
          </ul>
        </div>

        <div className="w-full max-w-md shrink-0">
          <div className="sdvg-card p-6 sm:p-7" style={{ boxShadow: brand.cardShadow }}>
            <h2 className="text-base font-semibold">Новая комната</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {authed
                ? 'Комната привязана к аккаунту — можно приглашать по ссылке.'
                : 'Имя видно напарнику в редакторе. Аккаунт не нужен.'}
            </p>

            {!authed ? (
              <div className="mt-5">
                <label htmlFor="live-name" className="block text-sm font-medium">
                  Ваше имя
                </label>
                <input
                  id="live-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Guest"
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm outline-none focus:border-border-strong"
                />
              </div>
            ) : null}

            <div className="mt-5">
              <span className="block text-sm font-medium">Язык</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {LIVE_LANGS.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setLanguage(lang.id)}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                      language === lang.id
                        ? 'border-border-strong bg-surface-2 font-medium text-text-primary'
                        : 'border-border text-text-secondary hover:border-border-strong',
                    ].join(' ')}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {createM.error ? (
              <div className="mt-4">
                <ErrorMessage message={formatApiError(createM.error)} />
              </div>
            ) : null}

            <Button className="mt-6 w-full" size="lg" loading={createM.isPending} onClick={handleCreate}>
              Создать комнату
            </Button>

            {!authed ? (
              <p className="mt-4 text-center text-xs text-text-muted">
                Есть аккаунт?{' '}
                <Link to="/login?next=/live/new" className="text-text-primary underline">
                  Войти
                </Link>
              </p>
            ) : null}
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-text-muted">
            Комната живёт несколько часов. Данные не сохраняются после истечения TTL.
          </p>
        </div>
      </main>
    </div>
  )
}
