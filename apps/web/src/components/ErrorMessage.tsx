import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useI18n } from '@/lib/i18n'

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <Card elevation="e1" className="border-danger/30 bg-danger/5">
      <p className="text-sm text-text-primary">{message}</p>
      {onRetry ? (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </Card>
  )
}
