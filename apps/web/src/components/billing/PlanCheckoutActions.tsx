import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n'
import { siteAwareClasses } from '@/lib/site/publicClasses'
import type { BillingMe, PlanCatalogEntry } from '@/lib/types'

export function PlanCheckoutActions({
  plan,
  isAuthed,
  isCurrent,
  hasTelegram,
  meLoading,
  billing,
  trialLoading,
  trialError,
  onStartTrial,
}: {
  plan: PlanCatalogEntry
  isAuthed: boolean
  isCurrent: boolean
  hasTelegram: boolean
  meLoading: boolean
  billing?: BillingMe
  trialLoading: boolean
  trialError: string | null
  onStartTrial: () => void | Promise<void>
}) {
  const { t } = useI18n()
  const c = siteAwareClasses(isAuthed)
  const returnUrl = `${window.location.origin}/pricing?paid=1`
  const trialDays = plan.trial_days ?? billing?.trial_days ?? 14
  const showTrialStart = !!billing?.trial_available && !billing?.is_trialing
  const isTrialing = !!billing?.is_trialing

  if (!isAuthed) {
    return (
      <Link to="/login?next=/pricing" className="mt-6 block">
        <Button variant={plan.highlight ? 'primary' : 'ghost'} className="w-full">
          {plan.slug === 'free' ? t('pricing.startFree') : t('pricing.loginForPro')}
        </Button>
      </Link>
    )
  }

  if (plan.slug === 'free' || (isCurrent && !isTrialing)) {
    return null
  }

  const webUrl = plan.checkout_url?.trim()
  const tgUrl = plan.telegram_checkout_url?.trim()
  const hasCheckout = !!(webUrl || tgUrl)

  if (meLoading) {
    return <p className={`mt-6 text-center text-xs ${c.muted}`}>{t('common.loading')}</p>
  }

  return (
    <div className="mt-6 space-y-3">
      {showTrialStart ? (
        <>
          <Button variant="primary" className="w-full" disabled={trialLoading} onClick={() => void onStartTrial()}>
            {trialLoading ? t('common.loading') : t('pricing.startTrial', { days: trialDays })}
          </Button>
          {trialError ? <p className="text-center text-xs text-danger">{trialError}</p> : null}
          <p className={`text-center text-[11px] ${c.muted}`}>{t('pricing.trialThenPay', { days: trialDays })}</p>
        </>
      ) : null}

      {isTrialing ? (
        <p className={`text-center text-xs ${c.secondary}`}>{t('pricing.trialActivePayHint')}</p>
      ) : null}

      {!showTrialStart && !hasCheckout && !isTrialing ? (
        <p className={`mt-6 text-center text-xs ${c.muted}`}>{t('pricing.checkoutUnavailable')}</p>
      ) : null}

      {(isTrialing || !showTrialStart) && hasCheckout ? (
        <>
          {!hasTelegram ? (
            <p className={`text-center text-xs ${c.secondary}`}>
              {t('pricing.linkTelegramFirst')}{' '}
              <Link to="/login" className={c.link}>
                {t('pricing.linkTelegramAction')}
              </Link>
            </p>
          ) : null}
          {webUrl ? (
            <a href={webUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant={showTrialStart ? 'ghost' : 'primary'} className="w-full" disabled={!hasTelegram}>
                {t('pricing.subscribeWeb')}
              </Button>
            </a>
          ) : null}
          {tgUrl ? (
            <a href={tgUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="ghost" className="w-full" disabled={!hasTelegram}>
                {t('pricing.subscribeTelegram')}
              </Button>
            </a>
          ) : null}
          {(webUrl || tgUrl) && hasTelegram ? (
            <Link to={`/checkout/${plan.slug}`} className={`block text-center text-xs ${c.muted} underline underline-offset-2`}>
              {t('checkout.eyebrow')}
            </Link>
          ) : null}
          {!isTrialing ? (
            <p className={`text-center text-[11px] ${c.muted}`}>
              {t('pricing.returnAfterPay', { url: returnUrl })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
