import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { brand } from '@/lib/brand/tokens'
import { useI18n } from '@/lib/i18n'

export function BillingUpsell({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <div
      className={`rounded-xl border bg-surface-1 px-4 py-3 text-sm ${className ?? ''}`}
      style={{ borderColor: brand.hairStrong }}
    >
      <p className="text-text-secondary">{t('billing.upgradeHint')}</p>
      <Link to="/checkout/pro_monthly" className="mt-3 inline-block">
        <Button variant="primary" size="sm">
          {t('billing.upgradeCta')}
        </Button>
      </Link>
    </div>
  )
}
