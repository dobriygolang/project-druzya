import { formatApiError } from '@/lib/apiClient'

type SandboxRunErrorLabels = {
  quota: string
  proFeature: string
}

export function formatSandboxRunError(err: unknown, labels: SandboxRunErrorLabels): string {
  const msg = formatApiError(err)
  if (msg.includes('quota exceeded')) return labels.quota
  if (msg.includes('feature not available on current plan')) return labels.proFeature
  return msg
}
