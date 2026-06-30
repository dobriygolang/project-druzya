import { useState } from 'react'
import { PublicPageShell } from '@/components/brand/PublicNav'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { formatApiError } from '@/lib/apiClient'
import { LIVE_LANGS, LIVE_ROOM_MODES, type LiveRoomModeId } from '@/lib/live/constants'
import { readGuestDisplayName, persistGuestDisplayName } from '@/lib/live/guestDisplayName'
import { useCreateLiveRoom } from '@/lib/live/useCreateLiveRoom'
import { useI18n } from '@/lib/i18n'

export function LiveNewPage() {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState(() => readGuestDisplayName())
  const [roomMode, setRoomMode] = useState<LiveRoomModeId>('code')
  const [language, setLanguage] = useState('go')

  const modeConfig = LIVE_ROOM_MODES.find((m) => m.id === roomMode) ?? LIVE_ROOM_MODES[0]
  const isDiagram = roomMode === 'diagram'
  const createM = useCreateLiveRoom()

  function handleCreate() {
    persistGuestDisplayName(displayName || t('common.guest'))
    createM.mutate({
      language: isDiagram ? 'diagram' : language,
      roomType: modeConfig.roomType,
      displayName: displayName || undefined,
    })
  }

  return (
    <PublicPageShell>
      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-6 pb-20 pt-12 sm:px-8 lg:flex-row lg:items-start lg:gap-16 lg:pt-16">
        <div className="flex-1 lg:max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-muted">{t('live.newEyebrow')}</p>
          <h1 className="mt-3 text-[clamp(2rem,5vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-site-text">
            {t('live.newTitle')}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-site-muted">{t('live.newBody')}</p>
          <ul className="mt-6 space-y-2.5 text-[13px] text-site-muted">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" />
              {t('live.newBulletGuest')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {t('live.newBulletPair')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" />
              {t('live.newBulletRun')}
            </li>
          </ul>
        </div>

        <div className="w-full max-w-md shrink-0">
          <div className="rounded-2xl border border-site-border bg-site-card p-6 sm:p-7">
            <h2 className="text-base font-semibold text-site-text">{t('live.newCardTitle')}</h2>
            <p className="mt-1 text-sm text-site-muted">{t('live.newCardGuest')}</p>

            <div className="mt-5">
              <label htmlFor="live-name" className="block text-sm font-medium text-site-text">
                {t('live.yourName')}
              </label>
              <input
                id="live-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('common.guest')}
                className="mt-1.5 w-full rounded-xl border border-site-border bg-site-bg px-3 py-2.5 text-sm text-site-text outline-none focus:border-site-muted"
              />
            </div>

            <div className="mt-5">
              <span className="block text-sm font-medium text-site-text">{t('live.roomMode')}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {LIVE_ROOM_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setRoomMode(mode.id)}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                      roomMode === mode.id
                        ? 'border-site-muted bg-site-surface font-medium text-site-text'
                        : 'border-site-border text-site-muted hover:border-site-muted',
                    ].join(' ')}
                  >
                    {mode.id === 'code' ? t('live.roomModeCode') : t('live.roomModeDiagram')}
                  </button>
                ))}
              </div>
            </div>

            {!isDiagram ? (
              <div className="mt-5">
                <span className="block text-sm font-medium text-site-text">{t('live.language')}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {LIVE_LANGS.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => setLanguage(lang.id)}
                      className={[
                        'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                        language === lang.id
                          ? 'border-site-muted bg-site-surface font-medium text-site-text'
                          : 'border-site-border text-site-muted hover:border-site-muted',
                      ].join(' ')}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {createM.error ? (
              <div className="mt-4">
                <ErrorMessage message={formatApiError(createM.error)} />
              </div>
            ) : null}

            <Button className="mt-6 w-full" size="lg" loading={createM.isPending} onClick={handleCreate}>
              {t('live.createRoom')}
            </Button>
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-site-muted">{t('live.ttlNote')}</p>
        </div>
      </main>
    </PublicPageShell>
  )
}
