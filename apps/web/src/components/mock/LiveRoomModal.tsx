import { useEffect, useState } from 'react'
import { ArrowRight, Users } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PillButton } from '@/components/mock/PillButton'
import { LIVE_LANGS } from '@/lib/live/constants'
import { readGuestDisplayName } from '@/lib/live/guestDisplayName'
import { useI18n } from '@/lib/i18n'

export type LiveCreateParams = {
  language: string
  displayName?: string
}

type Props = {
  open: boolean
  onClose: () => void
  authed: boolean
  starting: boolean
  onCreate: (params: LiveCreateParams) => void
}

export function LiveRoomModal({ open, onClose, authed, starting, onCreate }: Props) {
  const { t } = useI18n()
  const [language, setLanguage] = useState('go')
  const [guestName, setGuestName] = useState(() => readGuestDisplayName())

  useEffect(() => {
    if (!open) return
    setLanguage('go')
    setGuestName(readGuestDisplayName())
  }, [open])

  function handleCreate() {
    onCreate({
      language,
      displayName: authed ? undefined : guestName || undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('mock.live.title')}
      description={t('mock.live.description')}
      className="max-w-lg"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {!authed ? (
          <label className="block">
            <span className="text-[13px] text-text-secondary">{t('mock.live.displayName')}</span>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={t('common.guest')}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
          </label>
        ) : null}

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('mock.live.language')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LIVE_LANGS.map((lang) => (
              <PillButton key={lang.id} active={language === lang.id} onClick={() => setLanguage(lang.id)}>
                {lang.label}
              </PillButton>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          className="w-full sm:w-auto"
          icon={<Users className="h-4 w-4" />}
          iconRight={<ArrowRight className="h-4 w-4" />}
          loading={starting}
          onClick={handleCreate}
        >
          {t('mock.live.createRoom')}
        </Button>
      </div>
    </Modal>
  )
}
