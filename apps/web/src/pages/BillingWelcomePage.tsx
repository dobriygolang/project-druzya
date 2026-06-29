import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PublicOrAuthedShell } from '@/components/brand/PublicOrAuthedShell'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { PageContent } from '@/components/PageContent'
import { Button } from '@/components/ui/Button'
import { getBillingMe } from '@/lib/api/billing'
import { formatPlanName } from '@/lib/billingLabels'
import { readAccessToken } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { Navigate } from 'react-router-dom'

export default function BillingWelcomePage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const isAuthed = !!readAccessToken()

  const billingQ = useQuery({
    queryKey: ['billing-me'],
    queryFn: getBillingMe,
    enabled: isAuthed,
  })

  useEffect(() => {
    if (!isAuthed) return
    void queryClient.invalidateQueries({ queryKey: ['billing-me'] })
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['billing-me'] })
    }, 3000)
    return () => window.clearInterval(id)
  }, [isAuthed, queryClient])

  if (!isAuthed) {
    return <Navigate to="/login?next=/billing/welcome" replace />
  }

  const isPro = billingQ.data?.plan_slug != null && billingQ.data.plan_slug !== 'free'

  return (
    <PublicOrAuthedShell>
      <PageContent className="text-center">
        <Eyebrow>{t('checkout.welcomeEyebrow')}</Eyebrow>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {isPro ? t('checkout.welcomePro') : t('checkout.welcomePending')}
        </h1>
        {billingQ.data ? (
          <p className="mx-auto mt-3 max-w-md text-sm text-text-secondary">
            {formatPlanName(billingQ.data.plan_name, billingQ.data.plan_slug)}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/welcome">
            <Button variant="primary">{t('checkout.goWelcome')}</Button>
          </Link>
          <Link to="/profile">
            <Button variant="ghost">{t('public.account')}</Button>
          </Link>
        </div>
      </PageContent>
    </PublicOrAuthedShell>
  )
}
