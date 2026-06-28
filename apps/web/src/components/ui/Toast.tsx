import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { brand } from '@/lib/brand/tokens'
import { cn } from '@/lib/cn'

export type ToastVariant = 'error' | 'success' | 'info'

type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
}

type ToastContextValue = {
  push: (message: string, variant?: ToastVariant) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, variant: ToastVariant = 'error') => {
      const id = crypto.randomUUID()
      setItems((prev) => [...prev, { id, message, variant }])
      window.setTimeout(() => dismiss(id), 6000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(100vw-2rem,360px)] flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface-1 p-3.5 shadow-lg',
              t.variant === 'error' && 'border-danger/30',
              t.variant === 'success' && 'border-border-strong',
              t.variant === 'info' && 'border-border',
            )}
            style={{ boxShadow: brand.cardShadow }}
          >
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background:
                  t.variant === 'error' ? brand.dot : t.variant === 'success' ? brand.green : brand.ink40,
              }}
              aria-hidden
            />
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-text-primary">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 text-text-muted transition-colors hover:text-text-primary"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
